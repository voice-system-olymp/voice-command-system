import { useEffect, useState } from 'react';
import { Table, Select, Input, DatePicker, Space, Tag, Button, Typography, Modal, message, Popconfirm } from 'antd';
import { PlayCircleOutlined, EditOutlined, CheckOutlined, DeleteOutlined } from '@ant-design/icons';
import { listCommands, fetchAudioBlob, updateCommand, deleteCommand, reparseText } from '../api/commands';
import { useAuthStore } from '../stores/authStore';
import type { VoiceCommand } from '../types';
import { COMMAND_TYPES } from '../types';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

export default function HistoryPage() {
  const { user } = useAuthStore();
  const [data, setData] = useState<VoiceCommand[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<Record<string, string | undefined>>({});
  const [detail, setDetail] = useState<VoiceCommand | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Editing state
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [editCommand, setEditCommand] = useState<string | undefined>();
  const [editIdentifier, setEditIdentifier] = useState('');

  useEffect(() => {
    if (detail) {
      setAudioUrl(null);
      setEditing(false);
      fetchAudioBlob(detail.id).then(setAudioUrl);
    }
    return () => { if (audioUrl) URL.revokeObjectURL(audioUrl); };
  }, [detail]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number | undefined> = {
        ...filters,
        page,
        size: 20,
      };
      const { data: res } = await listCommands(params);
      setData(res.items);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [page, filters]);

  const startEdit = () => {
    if (!detail) return;
    setEditing(true);
    setEditText(detail.corrected_transcription || detail.raw_transcription);
    setEditCommand(detail.command_type || undefined);
    setEditIdentifier(detail.identifier || '');
  };

  const handleReparse = async () => {
    try {
      const { data } = await reparseText(editText);
      if (data.command_type) setEditCommand(data.command_type);
      if (data.identifier) setEditIdentifier(data.identifier);
      message.info(`Распознано: ${data.confidence}`);
    } catch {
      message.error('Ошибка разбора');
    }
  };

  const handleConfirm = async () => {
    if (!detail) return;
    try {
      const { data } = await updateCommand(detail.id, {
        corrected_transcription: editing ? editText : undefined,
        command_type: editing ? editCommand : detail.command_type,
        identifier: editing ? editIdentifier : detail.identifier,
        is_confirmed: true,
      });
      setDetail(data);
      setEditing(false);
      // Update in table
      setData((prev) => prev.map((c) => (c.id === data.id ? data : c)));
      message.success('Команда подтверждена');
    } catch {
      message.error('Ошибка сохранения');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCommand(id);
      setDetail(null);
      setData((prev) => prev.filter((c) => c.id !== id));
      setTotal((t) => t - 1);
      message.success('Запись удалена');
    } catch {
      message.error('Ошибка удаления');
    }
  };

  const columns = [
    {
      title: 'Дата',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (v: string) => dayjs(v).format('DD.MM.YYYY HH:mm'),
      width: 150,
    },
    ...(user?.role === 'admin' ? [{
      title: 'Оператор',
      dataIndex: 'username',
      key: 'username',
      width: 120,
    }] : []),
    {
      title: 'Команда',
      dataIndex: 'command_type',
      key: 'command_type',
      render: (v: string) => v ? <Tag color="blue">{v}</Tag> : <Tag>—</Tag>,
      width: 200,
    },
    {
      title: 'Идентификатор',
      dataIndex: 'identifier',
      key: 'identifier',
      render: (v: string) => v ? <code>{v}</code> : '—',
      width: 150,
    },
    {
      title: 'Транскрипция',
      dataIndex: 'raw_transcription',
      key: 'raw_transcription',
      ellipsis: true,
    },
    {
      title: 'Статус',
      key: 'status',
      width: 140,
      render: (_: unknown, r: VoiceCommand) => (
        r.is_confirmed ? <Tag color="green">Подтверждено</Tag> : <Tag color="orange">Ожидает</Tag>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 110,
      fixed: 'right' as const,
      render: (_: unknown, r: VoiceCommand) => (
        <Button size="small" icon={<PlayCircleOutlined />} onClick={() => setDetail(r)}>
          Детали
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Typography.Title level={3}>История команд</Typography.Title>
      <Space wrap style={{ marginBottom: 16 }}>
        <Select
          placeholder="Тип команды"
          allowClear
          style={{ width: 220 }}
          onChange={(v) => setFilters((f) => ({ ...f, command_type: v }))}
        >
          {COMMAND_TYPES.map((c) => <Select.Option key={c} value={c}>{c}</Select.Option>)}
        </Select>
        <Input
          placeholder="Идентификатор"
          allowClear
          style={{ width: 180 }}
          onChange={(e) => setFilters((f) => ({ ...f, identifier: e.target.value || undefined }))}
        />
        <RangePicker
          onChange={(dates) => {
            setFilters((f) => ({
              ...f,
              date_from: dates?.[0]?.toISOString(),
              date_to: dates?.[1]?.toISOString(),
            }));
          }}
        />
      </Space>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        scroll={{ x: 900 }}
        pagination={{ current: page, total, pageSize: 20, onChange: setPage }}
      />
      <Modal
        open={!!detail}
        onCancel={() => { setDetail(null); setEditing(false); }}
        title="Детали команды"
        footer={null}
        width={600}
      >
        {detail && (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <div><strong>Дата:</strong> {dayjs(detail.created_at).format('DD.MM.YYYY HH:mm:ss')}</div>
            {detail.username && <div><strong>Оператор:</strong> {detail.username}</div>}

            <div><strong>Аудиозапись:</strong></div>
            {audioUrl ? <audio controls src={audioUrl} style={{ width: '100%' }} /> : <span>Загрузка...</span>}

            {!editing ? (
              <>
                <div><strong>Транскрипция:</strong> {detail.raw_transcription}</div>
                {detail.corrected_transcription && (
                  <div><strong>Скорректировано:</strong> {detail.corrected_transcription}</div>
                )}
                <div>
                  <strong>Команда:</strong>{' '}
                  {detail.command_type ? <Tag color="blue">{detail.command_type}</Tag> : <Tag>—</Tag>}
                </div>
                <div>
                  <strong>Идентификатор:</strong>{' '}
                  {detail.identifier ? <code>{detail.identifier}</code> : '—'}
                </div>
                <div>
                  <strong>Статус:</strong>{' '}
                  {detail.is_confirmed ? <Tag color="green">Подтверждено</Tag> : <Tag color="orange">Ожидает</Tag>}
                </div>
                <Space>
                  {!detail.is_confirmed && (
                    <>
                      <Button icon={<EditOutlined />} onClick={startEdit}>Корректировать</Button>
                      <Button type="primary" icon={<CheckOutlined />} onClick={handleConfirm}>Подтвердить</Button>
                    </>
                  )}
                  <Popconfirm title="Удалить запись?" onConfirm={() => handleDelete(detail.id)} okText="Да" cancelText="Нет">
                    <Button danger icon={<DeleteOutlined />}>Удалить</Button>
                  </Popconfirm>
                </Space>
              </>
            ) : (
              <>
                <div>
                  <strong>Скорректированный текст:</strong>
                  <Input.TextArea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={2}
                    style={{ marginTop: 4 }}
                  />
                  <Button size="small" onClick={handleReparse} style={{ marginTop: 4 }}>Переразобрать</Button>
                </div>
                <div>
                  <strong>Команда:</strong>
                  <Select
                    value={editCommand}
                    onChange={setEditCommand}
                    allowClear
                    style={{ width: '100%', marginTop: 4 }}
                    placeholder="Выберите команду"
                  >
                    {COMMAND_TYPES.map((c) => (
                      <Select.Option key={c} value={c}>{c}</Select.Option>
                    ))}
                  </Select>
                </div>
                <div>
                  <strong>Идентификатор:</strong>
                  <Input value={editIdentifier} onChange={(e) => setEditIdentifier(e.target.value)} style={{ marginTop: 4 }} />
                </div>
                <Space>
                  <Button onClick={() => setEditing(false)}>Отмена</Button>
                  <Button type="primary" icon={<CheckOutlined />} onClick={handleConfirm}>Сохранить и подтвердить</Button>
                </Space>
              </>
            )}
          </Space>
        )}
      </Modal>
    </div>
  );
}
