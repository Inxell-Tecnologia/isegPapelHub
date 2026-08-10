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
