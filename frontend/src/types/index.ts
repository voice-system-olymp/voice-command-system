export interface User {
  id: string;
  username: string;
  full_name: string;
  role: 'admin' | 'operator';
  is_active: boolean;
  created_at: string;
}

export interface VoiceCommand {
  id: string;
  user_id: string;
  username?: string;
  audio_duration_ms?: number;
  raw_transcription: string;
  corrected_transcription?: string;
  command_type?: string;
  identifier?: string;
  is_confirmed: boolean;
  parse_success: boolean;
  created_at: string;
  confirmed_at?: string;
}

export interface CommandListResponse {
  items: VoiceCommand[];
  total: number;
  page: number;
  size: number;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export const COMMAND_TYPES = [
  'Зарегистрировать',
  'Начать обработку',
  'Отменить обработку',
  'Отменить регистрацию',
  'Завершить обработку',
] as const;
