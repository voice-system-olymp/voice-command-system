import client from './client';
import type { User } from '../types';

export const listUsers = () => client.get<User[]>('/users/');

export const createUser = (data: { username: string; full_name: string; password: string; role: string }) =>
  client.post<User>('/users/', data);

export const updateUser = (id: string, data: Record<string, unknown>) =>
  client.patch<User>(`/users/${id}`, data);

export const deleteUser = (id: string) => client.delete(`/users/${id}`);
