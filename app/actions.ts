'use server';

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function triggerScan(): Promise<{ success: boolean; emailsProcessed?: number; todosCreated?: number; error?: string }> {
  const res = await fetch(`${appUrl}/api/scan`, {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  });

  if (!res.ok && res.status !== 200) {
    return { success: false, error: `HTTP ${res.status}` };
  }

  return res.json();
}

export async function getTodos(): Promise<unknown[]> {
  const res = await fetch(`${appUrl}/api/todos`, {
    headers: { Authorization: `Bearer ${process.env.API_SECRET}` },
    cache: 'no-store',
  });

  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function updateTodoStatus(id: string, status: 'pending' | 'complete'): Promise<{ ok: boolean }> {
  const res = await fetch(`${appUrl}/api/todos`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.API_SECRET}`,
    },
    body: JSON.stringify({ id, status }),
  });

  return { ok: res.ok };
}
