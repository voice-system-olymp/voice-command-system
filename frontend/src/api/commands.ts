import client from './client';
import type { CommandListResponse, VoiceCommand } from '../types';

export const uploadAudio = (file: Blob) => {
  const form = new FormData();
  form.append('file', file, 'recording.webm');
  return client.post<VoiceCommand>('/commands/', form);
};

export const listCommands = (params: Record<string, string | number | undefined>) =>
  client.get<CommandListResponse>('/commands/', { params });

export const getCommand = (id: string) =>
  client.get<VoiceCommand>(`/commands/${id}`);

export const updateCommand = (id: string, data: Record<string, unknown>) =>
  client.patch<VoiceCommand>(`/commands/${id}`, data);

export const reparseText = (text: string) =>
  client.post<{ command_type: string | null; identifier: string | null; confidence: string }>(
    '/commands/reparse',
    { text },
  );

export const deleteCommand = (id: string) => client.delete(`/commands/${id}`);

export const fetchAudioBlob = async (id: string): Promise<string> => {
  const response = await client.get(`/commands/${id}/audio`, { responseType: 'blob' });
  return URL.createObjectURL(response.data);
};
