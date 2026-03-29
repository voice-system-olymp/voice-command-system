import { Layout as AntLayout, Menu } from 'antd';
import {
  AudioOutlined,
  HistoryOutlined,
  UserOutlined,
  LogoutOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

const { Sider, Header, Content } = AntLayout;

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const menuItems = [
    { key: '/', icon: <AudioOutlined />, label: 'Запись команды' },
    { key: '/history', icon: <HistoryOutlined />, label: 'История' },
  ];

  if (user?.role === 'admin') {
    menuItems.push({ key: '/admin/users', icon: <TeamOutlined />, label: 'Пользователи' });
  }

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider breakpoint="lg" collapsedWidth={0}>
        <div style={{ color: '#fff', padding: '16px', fontSize: 16, fontWeight: 600, textAlign: 'center' }}>
          Voice CMD
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <AntLayout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 16 }}>
          <span><UserOutlined /> {user?.full_name} ({user?.role})</span>
          <a onClick={() => { logout(); navigate('/login'); }}><LogoutOutlined /> Выйти</a>
        </Header>
        <Content style={{ margin: 24 }}>
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  );
}
