import { Button, Card, Form, Input, message, Typography } from 'antd';
import { useNavigate, Link } from 'react-router-dom';
import { login, getMe } from '../api/auth';
import { useAuthStore } from '../stores/authStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const { setTokens, setUser } = useAuthStore();

  const onFinish = async (values: { username: string; password: string }) => {
    try {
      const { data } = await login(values.username, values.password);
      setTokens(data.access_token, data.refresh_token);
      const me = await getMe();
      setUser(me.data);
      navigate('/');
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (detail === 'Account is blocked') {
        message.error('Аккаунт не активирован. Обратитесь к администратору.');
      } else {
        message.error('Неверный логин или пароль');
      }
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f0f2f5' }}>
      <Card style={{ width: 400 }}>
        <Typography.Title level={3} style={{ textAlign: 'center' }}>Вход в систему</Typography.Title>
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item name="username" label="Логин" rules={[{ required: true, message: 'Введите логин' }]}>
            <Input size="large" />
          </Form.Item>
          <Form.Item name="password" label="Пароль" rules={[{ required: true, message: 'Введите пароль' }]}>
            <Input.Password size="large" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block size="large">Войти</Button>
          </Form.Item>
          <div style={{ textAlign: 'center' }}>
            <Link to="/register">Регистрация</Link>
          </div>
        </Form>
      </Card>
    </div>
  );
}
