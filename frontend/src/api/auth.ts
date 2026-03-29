import client from './client';
import type { TokenResponse, User } from '../types';

export const login = (username: string, password: string) =>
  client.post<TokenResponse>('/auth/login', { username, password });

export const register = (username: string, full_name: string, password: string) =>
  client.post<User>('/auth/register', { username, full_name, password });

export const getMe = () => client.get<User>('/auth/me');
