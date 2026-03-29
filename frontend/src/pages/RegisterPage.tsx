import { Button, Card, Form, Input, message, Typography } from 'antd';
import { useNavigate, Link } from 'react-router-dom';
import { register } from '../api/auth';

export default function RegisterPage() {
  const navigate = useNavigate();

  const onFinish = async (values: { username: string; full_name: string; password: string }) => {
    try {
      await register(values.username, values.full_name, values.password);
      message.success('Регистрация отправлена. Дождитесь активации аккаунта администратором.');
      navigate('/login');
    } catch {
      message.error('Ошибка регистрации. Возможно, логин уже занят.');
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f0f2f5' }}>
      <Card style={{ width: 400 }}>
        <Typography.Title level={3} style={{ textAlign: 'center' }}>Регистрация</Typography.Title>
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item name="username" label="Логин" rules={[{ required: true }]}>
            <Input size="large" />
          </Form.Item>
          <Form.Item name="full_name" label="Полное имя" rules={[{ required: true }]}>
            <Input size="large" />
          </Form.Item>
          <Form.Item name="password" label="Пароль" rules={[{ required: true, min: 4 }]}>
            <Input.Password size="large" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block size="large">Зарегистрироваться</Button>
          </Form.Item>
          <div style={{ textAlign: 'center' }}>
            <Link to="/login">Уже есть аккаунт? Войти</Link>
          </div>
        </Form>
      </Card>
    </div>
  );
}
