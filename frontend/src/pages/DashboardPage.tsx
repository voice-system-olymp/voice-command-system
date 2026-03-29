import { useState, useEffect } from 'react';
import { Button, Card, Typography, Tag, Input, Select, Space, message, Spin, Alert } from 'antd';
import { AudioOutlined, CheckOutlined, EditOutlined } from '@ant-design/icons';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { uploadAudio, updateCommand, reparseText, fetchAudioBlob } from '../api/commands';
import type { VoiceCommand } from '../types';
import { COMMAND_TYPES } from '../types';

const { Title, Text } = Typography;

export default function DashboardPage() {
  const { isRecording, audioBlob, audioUrl, error: micError, startRecording, stopRecording } = useAudioRecorder();
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<VoiceCommand | null>(null);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [editCommand, setEditCommand] = useState<string | undefined>();
  const [editIdentifier, setEditIdentifier] = useState('');
  const [serverAudioUrl, setServerAudioUrl] = useState<string | null>(null);

  useEffect(() => {
    if (result) {
      fetchAudioBlob(result.id).then(setServerAudioUrl);
    }
    return () => { if (serverAudioUrl) URL.revokeObjectURL(serverAudioUrl); };
  }, [result]);

  const handleUpload = async () => {
    if (!audioBlob) return;
    setUploading(true);
    try {
      const { data } = await uploadAudio(audioBlob);
      setResult(data);
      message.success('Команда распознана');
    } catch {
      message.error('Ошибка распознавания');
    } finally {
      setUploading(false);
    }
  };

  const startEdit = () => {
    if (!result) return;
    setEditing(true);
    setEditText(result.corrected_transcription || result.raw_transcription);
    setEditCommand(result.command_type || undefined);
    setEditIdentifier(result.identifier || '');
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
    if (!result) return;
    try {
      const { data } = await updateCommand(result.id, {
        corrected_transcription: editing ? editText : undefined,
        command_type: editing ? editCommand : result.command_type,
        identifier: editing ? editIdentifier : result.identifier,
        is_confirmed: true,
      });
      setResult(data);
      setEditing(false);
      message.success('Команда подтверждена');
    } catch {
      message.error('Ошибка сохранения');
    }
  };

  const handleNewRecording = () => {
    setResult(null);
    setEditing(false);
  };

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <Title level={3}>Запись голосовой команды</Title>

      {micError && <Alert message={micError} type="error" style={{ marginBottom: 16 }} />}

      {!result && (
        <Card style={{ textAlign: 'center', padding: 40 }}>
          <Space direction="vertical" size="large">
            <Button
              type={isRecording ? 'default' : 'primary'}
              danger={isRecording}
              shape="circle"
              size="large"
              icon={<AudioOutlined />}
              style={{ width: 80, height: 80, fontSize: 32 }}
              onClick={isRecording ? stopRecording : startRecording}
            />
            <Text>{isRecording ? 'Запись... Нажмите для остановки' : 'Нажмите для записи'}</Text>
            {audioUrl && !uploading && (
              <>
                <audio controls src={audioUrl} style={{ width: '100%' }} />
                <Button type="primary" onClick={handleUpload} loading={uploading}>
                  Распознать команду
                </Button>
              </>
            )}
            {uploading && <Spin tip="Распознавание..." />}
          </Space>
        </Card>
      )}

      {result && (
        <Card>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <div>
              <Text type="secondary">Транскрипция:</Text>
              <div style={{ fontSize: 16, marginTop: 4 }}>{result.raw_transcription || '(пусто)'}</div>
            </div>

            {result.audio_duration_ms && (
              <Text type="secondary">Длительность: {(result.audio_duration_ms / 1000).toFixed(1)} сек</Text>
            )}

            {serverAudioUrl ? <audio controls src={serverAudioUrl} style={{ width: '100%' }} /> : <span>Загрузка аудио...</span>}

            {!editing ? (
              <>
                <div>
                  <Text type="secondary">Команда: </Text>
                  {result.command_type ? <Tag color="blue">{result.command_type}</Tag> : <Tag>Не распознана</Tag>}
                </div>
                <div>
                  <Text type="secondary">Идентификатор: </Text>
                  <Text code>{result.identifier || 'Не распознан'}</Text>
                </div>
                <div>
                  <Tag color={result.parse_success ? 'green' : 'orange'}>
                    {result.parse_success ? 'Полное распознавание' : 'Частичное распознавание'}
                  </Tag>
                  {result.is_confirmed && <Tag color="green">Подтверждено</Tag>}
                </div>
                {!result.is_confirmed && (
                  <Space>
                    <Button icon={<EditOutlined />} onClick={startEdit}>Корректировать</Button>
                    <Button type="primary" icon={<CheckOutlined />} onClick={handleConfirm}>Подтвердить</Button>
                  </Space>
                )}
              </>
            ) : (
              <>
                <div>
                  <Text type="secondary">Скорректированный текст:</Text>
                  <Input.TextArea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={2}
                    style={{ marginTop: 4 }}
                  />
                  <Button size="small" onClick={handleReparse} style={{ marginTop: 4 }}>
                    Переразобрать
                  </Button>
                </div>
                <div>
                  <Text type="secondary">Команда:</Text>
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
                  <Text type="secondary">Идентификатор:</Text>
                  <Input value={editIdentifier} onChange={(e) => setEditIdentifier(e.target.value)} style={{ marginTop: 4 }} />
                </div>
                <Space>
                  <Button onClick={() => setEditing(false)}>Отмена</Button>
                  <Button type="primary" icon={<CheckOutlined />} onClick={handleConfirm}>
                    Сохранить и подтвердить
                  </Button>
                </Space>
              </>
            )}

            <Button onClick={handleNewRecording}>Новая запись</Button>
          </Space>
        </Card>
      )}
    </div>
  );
}
