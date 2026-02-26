import type { Channel, ChannelCreate } from '../types/channel';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export async function fetchChannels(): Promise<Channel[]> {
  const res = await fetch(`${API_BASE}/channel/get_all`, {
    headers: { accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Failed to load channels: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : data.channels ?? [];
}

export async function createChannel(body: ChannelCreate): Promise<Channel> {
  const res = await fetch(`${API_BASE}/channel/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Failed to create channel: ${res.status}`);
  return res.json();
}

export async function updateChannel(
  id: number,
  patch: Partial<ChannelCreate & { show?: boolean }>
): Promise<Channel> {
  const res = await fetch(`${API_BASE}/channel/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`Failed to update channel: ${res.status}`);
  return res.json();
}

export interface ChannelEditBody {
  id?: number;
  name: string;
  nick_name: string;
  latitude: string;
  longitude: string;
  status: boolean;
}

export async function editChannel(body: ChannelEditBody): Promise<Channel> {
  const res = await fetch(`${API_BASE}/channel/edit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Failed to edit channel: ${res.status}`);
  return res.json();
}

export async function deleteChannel(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/channel/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Failed to delete channel: ${res.status}`);
}
