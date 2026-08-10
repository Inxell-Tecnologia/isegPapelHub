import { useMemo, useState } from 'react';
import { Avatar, Dropdown, Layout, Menu, Space, Typography } from 'antd';
import type { MenuProps } from 'antd';
import {
  ApartmentOutlined,
  DashboardOutlined,
  DeleteOutlined,
  FolderOutlined,
  HomeOutlined,
  LogoutOutlined,
  ReadOutlined,
  SearchOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { UserRole } from '@gdoc/shared';
import { useSession } from '../auth/session-context';
import { BrandMark } from './BrandMark';
import { NotificationCenter } from './NotificationCenter';

const { Header, Sider, Content } = Layout;

const ROLE_LABEL: Record<UserRole, string> = {
  [UserRole.COLLABORATOR]: 'Colaborador',
  [UserRole.UNIT_ADMIN]: 'Administrador da unidade',
  [UserRole.GLOBAL_ADMIN]: 'Administrador global',
};

/** Shell de layout (design.md D6): itens de administração só aparecem para `unit_admin`/`global_admin`. */
export function AppShell() {
  const { identity, logout, publicConfig } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const isAdmin =
    identity?.role === UserRole.UNIT_ADMIN || identity?.role === UserRole.GLOBAL_ADMIN;
  const isGlobalAdmin = identity?.role === UserRole.GLOBAL_ADMIN;

  // Prefixo (design.md D1, `web-navegacao`): qualquer rota sob `/pastas`
  // mantém "Arquivos" selecionado no menu, não só a raiz do explorador.
  const selectedKey = location.pathname.startsWith('/pastas') ? '/pastas' : location.pathname;

  const items = useMemo(
    () => [
      { key: '/', icon: <HomeOutlined />, label: <Link to="/">Início</Link> },
      { key: '/pastas', icon: <FolderOutlined />, label: <Link to="/pastas">Arquivos</Link> },
      { key: '/busca', icon: <SearchOutlined />, label: <Link to="/busca">Buscar</Link> },
      { key: '/lixeira', icon: <DeleteOutlined />, label: <Link to="/lixeira">Lixeira</Link> },
      ...(isAdmin
        ? [
            {
              key: '/admin/pessoas',
              icon: <TeamOutlined />,
              label: <Link to="/admin/pessoas">Pessoas</Link>,
            },
            {
              key: '/admin/painel',
              icon: <DashboardOutlined />,
              label: <Link to="/admin/painel">Painel</Link>,
            },
          ]
        : []),
      ...(isGlobalAdmin
        ? [
            {
              key: '/admin/unidades',
              icon: <ApartmentOutlined />,
              label: <Link to="/admin/unidades">Unidades</Link>,
            },
          ]
        : []),
    ],
    [isAdmin, isGlobalAdmin],
  );

  // Acesso auxiliar ao manual do usuário (change acesso-ao-manual-no-shell,
  // design.md D6/D8): segundo `<Menu>` de item único e `selectable={false}`
  // — não é destino da SPA, nunca deve disputar `selectedKeys` com a
  // navegação real nem aparecer como "tela atual". `title` explícito garante
  // o tooltip do estado colapsado em texto plano (não o link aninhado que o
  // AntD usaria por padrão a partir do `label`). O nome acessível do link
  // anuncia a saída da aplicação para quem usa leitor de tela.
  const manualMenuItems: MenuProps['items'] = publicConfig.manualUrl
    ? [
        {
          key: 'manual-do-usuario',
          icon: <ReadOutlined />,
          title: 'Manual do usuário',
          label: (
            <a
              href={publicConfig.manualUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Manual do usuário (abre em nova aba, fora da aplicação)"
            >
              Manual do usuário
            </a>
          ),
        },
      ]
    : undefined;

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  // Menu de identidade (change `troca-de-senha`, design.md D5/D6): "Minha
  // conta" é oferecida a qualquer papel, inclusive `collaborator` — não é
  // item de administração.
  const identityMenuItems: MenuProps['items'] = [
    {
      key: 'minha-conta',
      icon: <UserOutlined />,
      label: <Link to="/minha-conta">Minha conta</Link>,
    },
    { type: 'divider' },
    { key: 'sair', icon: <LogoutOutlined />, label: 'Sair', onClick: handleLogout },
  ];

  if (!identity) return null;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
        {/* Wrapper flex column (design.md D6): `.ant-layout-sider-children` do
            AntD não é flex por padrão, então o próprio conteúdo do Sider
            precisa impor a coluna para o rodapé do manual (`margin-top: auto`
            abaixo) empurrar para o pé, sem depender de CSS global novo. O
            trigger de colapso do AntD é `position: fixed`, fora deste fluxo,
            então não interfere. */}
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ minHeight: 48, margin: 16 }}>
            {collapsed ? (
              <div style={{ color: '#fff', fontWeight: 600, fontSize: 18, lineHeight: '24px' }}>
                PH
              </div>
            ) : (
              // Shell expandido (design.md D7): não há texto irmão do nome aqui, então
              // a logomarca carrega o nome acessível diretamente via `alt`.
              <BrandMark height={40} alt="PapelHub" />
            )}
            {/* Identificação do cliente só no estado expandido (design.md D6) —
                o colapsado não tem largura para o subtítulo sem truncar. */}
            {!collapsed && publicConfig.clientName && (
              <div style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: 12, lineHeight: '16px' }}>
                {publicConfig.clientName}
              </div>
            )}
          </div>
          <Menu theme="dark" mode="inline" selectedKeys={[selectedKey]} items={items} />
          {manualMenuItems && (
            <Menu
              theme="dark"
              mode="inline"
              selectable={false}
              items={manualMenuItems}
              style={{ marginTop: 'auto' }}
            />
          )}
        </div>
      </Sider>
      <Layout>
        <Header
          style={{
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 12,
            padding: '0 24px',
          }}
        >
          <NotificationCenter />
          <Dropdown menu={{ items: identityMenuItems }} trigger={['click']}>
            <Space style={{ cursor: 'pointer' }}>
              <Avatar>{identity.id.slice(0, 2).toUpperCase()}</Avatar>
              <Typography.Text>{ROLE_LABEL[identity.role]}</Typography.Text>
            </Space>
          </Dropdown>
        </Header>
        <Content style={{ margin: 24 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
