import type { CustomFieldData, EditCustomFieldPayload } from '../types/customField';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export async function getCustomField(code: string): Promise<CustomFieldData | null> {
  if (!code || code.trim() === '') return null;
  const url = `${API_BASE}/custom_field/get/${encodeURIComponent(code.trim())}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { accept: 'application/json' },
  });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Custom field API error: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as CustomFieldData;
}

export async function editCustomField(
  id: number,
  payload: EditCustomFieldPayload
): Promise<CustomFieldData> {
  const url = `${API_BASE}/custom_field/edit/${id}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Edit custom field error: ${res.status} ${res.statusText}`);
  return (await res.json()) as CustomFieldData;
}
