"""Modelo de custo GCP para o PapelHub (GDoc) — região us-central1 (Iowa).

Gera as tabelas de `estimativa.html`. Os valores no HTML são ESTÁTICOS por
decisão: uma proposta comercial precisa citar números estáveis e auditáveis,
não um cálculo que muda sozinho entre a cotação e a assinatura.

Para atualizar: reconfira os preços em cloud.google.com/{storage,sql,run}/pricing
(selecionando us-central1), ajuste o dicionário P e PRICE_DATE abaixo, rode
`python3 modelo.py` e transponha os números para estimativa.html — incluindo a
data-base no topo do documento.

Unidade de cobrança do Google: GiB (a página de preços declara 1 GB = 2^30 bytes).
"""

# Data em que os preços de lista abaixo foram consultados na fonte.
# Precisa bater com a data-base exibida no topo de estimativa.html.
PRICE_DATE = "2026-08-12"
REGION = "us-central1"

H = 730.0  # horas/mês faturáveis (média GCP)
S = H * 3600  # segundos/mês

# ---------- PREÇOS DE LISTA us-central1 (USD) ----------
P = dict(
    gcs_standard=0.020,        # /GiB/mês
    gcs_nearline=0.010,
    gcs_coldline=0.004,
    gcs_archive=0.0012,
    gcs_class_a=0.005 / 1000,  # /operação
    gcs_class_b=0.0004 / 1000,
    egress_t1=0.12,            # /GiB, 0–10 TiB
    egress_t2=0.11,            # 10–150 TiB
    egress_t3=0.08,            # >150 TiB
    run_cpu_active=0.000024,   # /vCPU-s
    run_cpu_idle=0.0000025,
    run_mem_active=0.0000025,  # /GiB-s
    run_mem_idle=0.0000025,
    run_req=0.40 / 1e6,
    sql_vcpu=0.0413,           # /h  (Enterprise)
    sql_mem=0.007,             # /GiB/h
    sql_vcpu_ha=0.0826,
    sql_mem_ha=0.014,
    sql_ssd=0.17,              # /GiB/mês
    sql_ssd_ha=0.34,
    sql_backup=0.08,           # /GiB/mês (backup usado)
    sql_f1_micro=0.0105,       # /h
    lb_proxy=0.025,            # /h
    lb_data=0.008,             # /GiB processado
    artifact_registry=0.10,    # /GiB/mês
)


def egress_cost(gib):
    """Escalonado: 0–10 TiB, 10–150 TiB, >150 TiB."""
    t1, t2 = 10 * 1024, 150 * 1024
    c = min(gib, t1) * P["egress_t1"]
    if gib > t1:
        c += (min(gib, t2) - t1) * P["egress_t2"]
    if gib > t2:
        c += (gib - t2) * P["egress_t3"]
    return c


# ---------- PERFIS DE CARGA POR FUNCIONÁRIO / MÊS ----------
# Perfil "uso corporativo moderado" de um GED.
UPLOADS_MES = 40         # objetos novos -> operações Classe A
LEITURAS_MES = 250       # visualizações + downloads -> Classe B
REQS_API_MES = 1500      # navegação, busca, login, listagens

# Horas/mês em que o Cloud Run tem requisição em voo (instância "ativa").
HORAS_ATIVAS = {50: 70, 100: 120, 200: 200, 300: 280}

# Tier do Cloud SQL por porte (Enterprise, dedicated-core = coberto por SLA em HA).
# O banco guarda SÓ metadados (quem, o quê, quando, qual permissão) — nenhum byte
# de arquivo passa por ele. Logo o porte acompanha usuários SIMULTÂNEOS, não volume.
# 300 pessoas ~ 450k requisições/mês ~ 0,7 req/s média, 4-5 req/s de pico: folgado
# para 2 vCPU. Subir para 4 vCPU é troca de tier em minutos, sem migração.
SQL_TIER = {  # (vCPU, GiB RAM, GiB SSD)
    50:  (1, 3.75, 20),
    100: (1, 3.75, 30),
    200: (2, 7.5, 50),
    300: (2, 7.5, 75),
}

# Instâncias mínimas do Cloud Run por plano.
MIN_INST = {"essencial": 0, "padrao": 1, "ha": 2}
MEM_GIB = {"essencial": 0.5, "padrao": 1.0, "ha": 1.0}


def custo_aplicacao(func, plano):
    """Cloud Run (API+SPA) + LB + registry. Bytes de arquivo NÃO passam aqui."""
    mem = MEM_GIB[plano]
    ativo_s = HORAS_ATIVAS[func] * 3600
    minst = MIN_INST[plano]

    taxa_ativa = P["run_cpu_active"] + P["run_mem_active"] * mem
    taxa_ociosa = P["run_cpu_idle"] + P["run_mem_idle"] * mem

    if minst == 0:
        run = ativo_s * taxa_ativa            # escala a zero: só tempo ativo
    else:
        run = ativo_s * taxa_ativa
        run += (minst * S - ativo_s) * taxa_ociosa

    reqs = func * REQS_API_MES
    run += reqs * P["run_req"]

    # Balanceador (só existe com domínio próprio) — planos padrão/ha.
    lb = 0.0
    if plano in ("padrao", "ha"):
        lb = P["lb_proxy"] * H
        lb += (func * 0.25) * P["lb_data"]     # ~250 MiB de SPA+JSON por pessoa/mês

    registry = 5 * P["artifact_registry"]      # ~5 GiB de imagens
    jobs = 0.30                                # 2 jobs diários, segundos cada
    return dict(cloud_run=run, load_balancer=lb, outros=registry + jobs,
                total=run + lb + registry + jobs)


def custo_banco(func, plano):
    vcpu, ram, ssd = SQL_TIER[func]
    if plano == "essencial":
        inst = P["sql_f1_micro"] * H
        ssd = 10
        disco = ssd * P["sql_ssd"]
        backup = ssd * 1.0 * P["sql_backup"]           # 7 backups diários, sem PITR
    elif plano == "padrao":
        inst = (vcpu * P["sql_vcpu"] + ram * P["sql_mem"]) * H
        disco = ssd * P["sql_ssd"]
        backup = ssd * 1.5 * P["sql_backup"]           # backups + WAL do PITR
    else:  # ha
        inst = (vcpu * P["sql_vcpu_ha"] + ram * P["sql_mem_ha"]) * H
        disco = ssd * P["sql_ssd_ha"]
        backup = ssd * 1.5 * P["sql_backup"]
    return dict(instancia=inst, disco=disco, backup=backup,
                total=inst + disco + backup)


def custo_storage(gib, func):
    """Armazenamento de arquivos. Egress fica FORA (é variável, tabela própria)."""
    armaz = gib * P["gcs_standard"]
    soft_delete = gib * 0.03 * (7 / 30) * P["gcs_standard"]   # 3% de churn/mês, 7 dias retidos
    ops_a = func * UPLOADS_MES * 2 * P["gcs_class_a"]         # PUT + finalize
    ops_b = func * LEITURAS_MES * P["gcs_class_b"]
    return dict(armazenamento=armaz, soft_delete=soft_delete,
                operacoes=ops_a + ops_b,
                total=armaz + soft_delete + ops_a + ops_b)


VOLUMES = [200, 300, 400, 500, 600, 700, 800, 900, 1024,
           10 * 1024, 20 * 1024, 30 * 1024, 40 * 1024, 50 * 1024]
FUNCS = [50, 100, 200, 300]
PERFIS_EGRESS = {"Leve": 2, "Moderado": 8, "Intenso": 25}   # GiB baixados/func/mês


def rotulo(gib):
    return f"{gib} GB" if gib < 1024 else f"{gib // 1024} TB"


def brl(v, cambio=5.40):
    return v * cambio


if __name__ == "__main__":
    print(f"Preços de lista de {REGION}, consultados em {PRICE_DATE}.")
    print("Confira se esta data ainda é a exibida no topo de estimativa.html.")

    print("\n=== APLICAÇÃO (Cloud Run + LB) — USD/mês ===")
    print(f"{'Func':>5} | {'Essencial':>10} | {'Padrão':>10} | {'Alta disp.':>10}")
    for f in FUNCS:
        r = {p: custo_aplicacao(f, p) for p in ("essencial", "padrao", "ha")}
        print(f"{f:>5} | {r['essencial']['total']:>10.2f} | {r['padrao']['total']:>10.2f} | {r['ha']['total']:>10.2f}")

    print("\n=== BANCO DE DADOS (Cloud SQL) — USD/mês ===")
    print(f"{'Func':>5} | {'Essencial':>10} | {'Padrão':>10} | {'Alta disp.':>10} | tier padrão")
    for f in FUNCS:
        r = {p: custo_banco(f, p) for p in ("essencial", "padrao", "ha")}
        v, m, d = SQL_TIER[f]
        print(f"{f:>5} | {r['essencial']['total']:>10.2f} | {r['padrao']['total']:>10.2f} | {r['ha']['total']:>10.2f} | {v} vCPU / {m} GB RAM / {d} GB")

    print("\n=== ARMAZENAMENTO — USD/mês (independe do plano) ===")
    print(f"{'Volume':>8} | {'50 func':>9} | {'100':>9} | {'200':>9} | {'300':>9}")
    for g in VOLUMES:
        row = {f: custo_storage(g, f)["total"] for f in FUNCS}
        print(f"{rotulo(g):>8} | " + " | ".join(f"{row[f]:>9.2f}" for f in FUNCS))

    print("\n=== TRÁFEGO DE DOWNLOAD (egress) — USD/mês ===")
    print(f"{'Func':>5} | " + " | ".join(f"{k:>22}" for k in PERFIS_EGRESS))
    for f in FUNCS:
        cells = {}
        for nome, gb in PERFIS_EGRESS.items():
            tot = f * gb
            cells[nome] = (tot, egress_cost(tot))
        print(f"{f:>5} | " + " | ".join(
            f"{v[0]:>7.0f} GB = {v[1]:>8.2f}" for v in cells.values()))

    print("\n=== MATRIZ TOTAL — plano Padrão, SEM tráfego de download (USD/mês) ===")
    print(f"{'Volume':>8} | {'50 func':>9} | {'100':>9} | {'200':>9} | {'300':>9}")
    for g in VOLUMES:
        row = {}
        for f in FUNCS:
            row[f] = (custo_aplicacao(f, "padrao")["total"]
                      + custo_banco(f, "padrao")["total"]
                      + custo_storage(g, f)["total"])
        print(f"{rotulo(g):>8} | " + " | ".join(f"{row[f]:>9.2f}" for f in FUNCS))

    print("\n=== COMPOSIÇÃO (plano Padrão) — onde o dinheiro vai ===")
    for g, f in [(200, 50), (1024, 100), (10 * 1024, 200), (50 * 1024, 300)]:
        a = custo_aplicacao(f, "padrao")["total"]
        b = custo_banco(f, "padrao")["total"]
        s = custo_storage(g, f)["total"]
        e = egress_cost(f * PERFIS_EGRESS["Moderado"])
        t = a + b + s + e
        print(f"{rotulo(g):>8} / {f:>3} func -> app {a/t:5.1%} | banco {b/t:5.1%} | "
              f"storage {s/t:5.1%} | download {e/t:5.1%}  (total ${t:,.2f})")

    print("\n=== ALAVANCA: ciclo de vida p/ Nearline após 90 dias (70% do acervo frio) ===")
    for g in [10 * 1024, 30 * 1024, 50 * 1024]:
        quente, frio = g * 0.30, g * 0.70
        std = g * P["gcs_standard"]
        misto = quente * P["gcs_standard"] + frio * P["gcs_nearline"]
        print(f"{rotulo(g):>8}: Standard ${std:>8,.2f}  ->  misto ${misto:>8,.2f}  "
              f"(economia ${std-misto:>7,.2f}/mês, {(std-misto)/std:.0%})")

    print("\n=== TETO DE COTA (10 GiB/pessoa, config atual) ===")
    for f in FUNCS:
        print(f"{f:>3} funcionários -> teto {f*10/1024:.2f} TB de acervo")

