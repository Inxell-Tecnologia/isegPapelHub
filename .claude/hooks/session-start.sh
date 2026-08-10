#!/bin/bash
# SessionStart hook — "o Terraform do sandbox" (ver design.md, Decisão 3).
# Provisiona, de forma idempotente, o equivalente dev dos recursos GCP:
# Postgres local (↔ Cloud SQL) e fake-gcs-server (↔ Cloud Storage). Não é
# dono do ciclo de vida da API/web — esses sobem sob demanda (`make dev`).
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$PROJECT_DIR"

DB_NAME="gdoc_dev"
DB_USER="gdoc_dev"
DB_PASSWORD="gdoc_dev"
DB_PORT="5432"
GCS_PORT="4443"
GCS_BUCKET="gdoc-dev-bucket"
GCS_DATA_DIR="$PROJECT_DIR/.dev/fake-gcs-data"
GCS_LOG="$PROJECT_DIR/.dev/fake-gcs-server.log"
SIGNER_KEY_PATH="$PROJECT_DIR/.dev/fake-gcs-signer-key.json"

echo "==> [1/6] Instalando dependências (npm workspaces)"
npm install --workspaces --include-workspace-root

echo "==> [2/6] Subindo Postgres local (equivalente dev do Cloud SQL)"
if ! pg_lsclusters 2>/dev/null | awk '$1=="16" && $2=="main" {print $4}' | grep -q online; then
  sudo pg_ctlcluster 16 main start
fi

for _ in $(seq 1 30); do
  if pg_isready -h 127.0.0.1 -p "$DB_PORT" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "==> [3/6] Garantindo role e database de desenvolvimento (idempotente)"
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1; then
  sudo -u postgres psql -c "CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}'"
fi
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}"
fi

echo "==> [4/6] Subindo fake-gcs-server (equivalente dev do Cloud Storage)"
mkdir -p "$GCS_DATA_DIR"
if ! curl -sf "http://127.0.0.1:${GCS_PORT}/storage/v1/b" >/dev/null 2>&1; then
  FAKE_GCS_BIN="$(command -v fake-gcs-server || echo "$HOME/go/bin/fake-gcs-server")"
  nohup "$FAKE_GCS_BIN" -scheme http -port "$GCS_PORT" -public-host "127.0.0.1:${GCS_PORT}" \
    -data "$GCS_DATA_DIR" >"$GCS_LOG" 2>&1 &
  disown

  for _ in $(seq 1 30); do
    if curl -sf "http://127.0.0.1:${GCS_PORT}/storage/v1/b" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
fi

if ! curl -sf "http://127.0.0.1:${GCS_PORT}/storage/v1/b/${GCS_BUCKET}" >/dev/null 2>&1; then
  curl -sf -X POST -H 'Content-Type: application/json' \
    -d "{\"name\":\"${GCS_BUCKET}\"}" \
    "http://127.0.0.1:${GCS_PORT}/storage/v1/b?project=gdoc-dev" >/dev/null
fi

echo "==> [5/6] Gerando chave dummy de assinatura (dev-only) e aplicando migrações/seed"
node scripts/generate-dev-signer-key.mjs

if [ ! -f "$PROJECT_DIR/.env" ]; then
  cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
else
  # Reconciliação (design.md D4, change corrige-alcance-do-manual):
  # idempotência aqui significa convergir para o conjunto de chaves do
  # exemplo, não apenas "não fazer nada se o arquivo já existe" — senão toda
  # variável nova introduzida depois da criação do .env local fica invisível
  # para sempre neste sandbox. Só acrescenta chave AUSENTE, com o valor do
  # exemplo; nunca sobrescreve, remove ou reordena o que já está em .env.
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      ''|'#'*) continue ;;
    esac
    key="${line%%=*}"
    if ! grep -q "^${key}=" "$PROJECT_DIR/.env"; then
      echo "$line" >>"$PROJECT_DIR/.env"
    fi
  done <"$PROJECT_DIR/.env.example"
fi

npm run migrate --workspace apps/api
npm run seed --workspace apps/api

echo "==> [6/6] Provisionamento de dev pronto (Postgres :${DB_PORT}, fake-gcs-server :${GCS_PORT})"
