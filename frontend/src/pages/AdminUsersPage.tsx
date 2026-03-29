import { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, Switch, Space, Typography, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { listUsers, createUser, updateUser } from '../api/users';
import type { User } from '../types';
import dayjs from 'dayjs';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data } = await listUsers();
      setUsers(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreate = async (values: { username: string; full_name: string; password: string; role: string }) => {
    try {
      await createUser(values);
      message.success('Пользователь создан');
      setModalOpen(false);
      form.resetFields();
      fetchUsers();
    } catch {
      message.error('Ошибка создания');
    }
  };

  const toggleActive = async (user: User) => {
    await updateUser(user.id, { is_active: !user.is_active });
    fetchUsers();
  };

  const changeRole = async (user: User, role: string) => {
    await updateUser(user.id, { role });
    fetchUsers();
  };

  const columns = [
    { title: 'Логин', dataIndex: 'username', key: 'username' },
    { title: 'Имя', dataIndex: 'full_name', key: 'full_name' },
    {
      title: 'Роль',
      dataIndex: 'role',
      key: 'role',
      render: (role: string, record: User) => (
        <Select value={role} onChange={(v) => changeRole(record, v)} style={{ width: 130 }}>
          <Select.Option value="admin">Админ</Select.Option>
          <Select.Option value="operator">Оператор</Select.Option>
        </Select>
      ),
    },
    {
      title: 'Активен',
      key: 'is_active',
      render: (_: unknown, record: User) => (
        <Switch checked={record.is_active} onChange={() => toggleActive(record)} />
      ),
    },
    {
      title: 'Создан',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (v: string) => dayjs(v).format('DD.MM.YYYY'),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }}>
        <Typography.Title level={3} style={{ margin: 0 }}>Управление пользователями</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          Создать пользователя
        </Button>
      </Space>
      <Table rowKey="id" columns={columns} dataSource={users} loading={loading} pagination={false} />
      <Modal
        title="Новый пользователь"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="username" label="Логин" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="full_name" label="Полное имя" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label="Пароль" rules={[{ required: true, min: 4 }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="role" label="Роль" initialValue="operator">
            <Select>
              <Select.Option value="operator">Оператор</Select.Option>
              <Select.Option value="admin">Админ</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
