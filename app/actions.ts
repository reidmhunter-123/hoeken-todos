'use server';

export async function triggerScan(): Promise<{ success: boolean; emailsProcessed?: number; todosCreated?: number; error?: string }> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const res = await fetch(`${appUrl}/api/scan`, {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  });

  if (!res.ok && res.status !== 200) {
    return { success: false, error: `HTTP ${res.status}` };
  }

  return res.json();
}
