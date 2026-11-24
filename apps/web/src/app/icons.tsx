import type { ComponentProps } from 'react';
import {
  ArrowRightLeft,
  Bell,
  BookCheck,
  BookOpen,
  Building2,
  CircleHelp,
  CirclePlay,
  ClipboardList,
  Compass,
  Clock,
  CloudDownload,
  Copy,
  Download,
  Eraser,
  Eye,
  File,
  Folder,
  FolderOpen,
  FolderPlus,
  House,
  Inbox,
  LayoutDashboard,
  Lock,
  LogOut,
  Mail,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  EllipsisVertical,
  Pencil,
  Plus,
  RotateCw,
  ScrollText,
  Search,
  Share2,
  Star,
  Trash2,
  Undo2,
  Upload,
  User,
  Users,
} from 'lucide-react';

/**
 * Origem única da iconografia da SPA (capability `sistema-de-design`,
 * requisito "Iconografia provém de biblioteca única"; change
 * `identidade-visual-isetes`, design.md D6).
 *
 * A biblioteca é o Lucide, e **só** ela: duas bibliotecas de ícones
 * apareceriam lado a lado na mesma tela — a navegação e a tabela do
 * explorador, por exemplo — com traços visivelmente diferentes, e o
 * requisito proíbe essa coexistência. Nenhuma tela importa de
 * `lucide-react` diretamente: importa daqui, por **função de interface**.
 * É esse nome por função que mantém o mapeamento auditável contra o bloco de
 * iconografia do guia do cliente, em vez de espalhar a escolha do glifo por
 * onze arquivos.
 */

/** Traço do guia do cliente. O design system dimensiona o ícone pelo texto, então o tamanho é relativo. */
const TRACO = 1.8;

type PropsIcone = Omit<ComponentProps<typeof House>, 'size' | 'strokeWidth'>;

/**
 * Configura um glifo com o traço e o alinhamento do produto. O ícone é
 * sempre `aria-hidden`: quem carrega o nome acessível é o controle que o
 * recebe (rótulo visível ou `aria-label`), nunca o desenho — mesma garantia
 * que os ícones do design system davam.
 */
function criarIcone(Glifo: typeof House, nome: string) {
  function Icone(props: PropsIcone) {
    return (
      <Glifo
        size="1em"
        strokeWidth={TRACO}
        aria-hidden="true"
        focusable="false"
        {...props}
        style={{ display: 'inline-block', verticalAlign: '-0.125em', ...props.style }}
      />
    );
  }
  Icone.displayName = nome;
  return Icone;
}

// Navegação do shell
export const IconeInicio = criarIcone(House, 'IconeInicio');
export const IconeArquivos = criarIcone(Folder, 'IconeArquivos');
export const IconeBuscar = criarIcone(Search, 'IconeBuscar');
export const IconeRecentes = criarIcone(Clock, 'IconeRecentes');
export const IconeLixeira = criarIcone(Trash2, 'IconeLixeira');
export const IconeColaboradores = criarIcone(Users, 'IconeColaboradores');
export const IconePainel = criarIcone(LayoutDashboard, 'IconePainel');
export const IconeUnidades = criarIcone(Building2, 'IconeUnidades');
export const IconeManual = criarIcone(BookOpen, 'IconeManual');
export const IconeLeituraObrigatoria = criarIcone(BookCheck, 'IconeLeituraObrigatoria');
export const IconeMenu = criarIcone(Menu, 'IconeMenu');
export const IconeConta = criarIcone(User, 'IconeConta');
export const IconeSair = criarIcone(LogOut, 'IconeSair');
export const IconeNotificacoes = criarIcone(Bell, 'IconeNotificacoes');

// Itens do explorador e da lixeira
export const IconePasta = criarIcone(Folder, 'IconePasta');
/** Destino "Compartilhados comigo" (US 4.4): o que chegou por concessão de outra pessoa. */
export const IconeCompartilhados = criarIcone(Share2, 'IconeCompartilhados');
export const IconeFavorito = criarIcone(Star, 'IconeFavorito');
export const IconePastaAberta = criarIcone(FolderOpen, 'IconePastaAberta');
export const IconeArquivo = criarIcone(File, 'IconeArquivo');
export const IconeNovaPasta = criarIcone(FolderPlus, 'IconeNovaPasta');
export const IconeNovo = criarIcone(Plus, 'IconeNovo');
export const IconeVisualizar = criarIcone(Eye, 'IconeVisualizar');
export const IconeBaixar = criarIcone(Download, 'IconeBaixar');
export const IconeBaixarVarios = criarIcone(CloudDownload, 'IconeBaixarVarios');
export const IconeRenomear = criarIcone(Pencil, 'IconeRenomear');
export const IconeMover = criarIcone(ArrowRightLeft, 'IconeMover');
export const IconeExcluir = criarIcone(Trash2, 'IconeExcluir');
export const IconeRestaurar = criarIcone(Undo2, 'IconeRestaurar');
export const IconeAuditoria = criarIcone(ScrollText, 'IconeAuditoria');
export const IconePermissoes = criarIcone(Lock, 'IconePermissoes');
export const IconeMaisAcoes = criarIcone(EllipsisVertical, 'IconeMaisAcoes');
export const IconeControleDocumental = criarIcone(ClipboardList, 'IconeControleDocumental');

// Envio
export const IconeAjuda = criarIcone(CircleHelp, 'IconeAjuda');
export const IconeTour = criarIcone(Compass, 'IconeTour');
/** Convite ao tour na tela inicial (demanda nº 3, item 8: "ícone de play"). */
export const IconeIniciarTour = criarIcone(CirclePlay, 'IconeIniciarTour');
export const IconeEnviar = criarIcone(Upload, 'IconeEnviar');
export const IconeEnviarPasta = criarIcone(FolderOpen, 'IconeEnviarPasta');
export const IconeArrastarSoltar = criarIcone(Inbox, 'IconeArrastarSoltar');
export const IconeTentarNovamente = criarIcone(RotateCw, 'IconeTentarNovamente');

// Formulários e utilidades
export const IconeEmail = criarIcone(Mail, 'IconeEmail');
export const IconeSenha = criarIcone(Lock, 'IconeSenha');
export const IconeCopiar = criarIcone(Copy, 'IconeCopiar');
export const IconeLimparFiltros = criarIcone(Eraser, 'IconeLimparFiltros');
/** Recolher / expandir a navegação lateral — controle no topo da coluna. */
export const IconeRecolherNavegacao = criarIcone(PanelLeftClose, 'IconeRecolherNavegacao');
export const IconeExpandirNavegacao = criarIcone(PanelLeftOpen, 'IconeExpandirNavegacao');
