'use client';

import { useEffect, useState } from 'react';
import { triggerScan, getTodos, updateTodoStatus } from './actions';

type Todo = {
  id: string;
  created_at: string;
  source_email_subject: string;
  source_email_from: string;
  source_email_date: string;
  task: string;
  category: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'complete';
  completed_at: string | null;
};

const PRIORITY_COLORS = {
  high: '#E85D4A',
  medium: '#E8A84A',
  low: '#4A9E6B',
};

const CATEGORY_ICONS: Record<string, string> = {
  'Client Follow-up': '👤',
  'Listing': '🏠',
  'Internal': '⚙️',
  'TSMC': '🤝',
  'Vendor': '📦',
  'Legal/Contract': '📋',
  'Marketing': '📣',
  'Other': '📌',
};

export default function Dashboard() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'complete'>('pending');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success')) {
      setSuccessMessage('Gmail connected successfully!');
      window.history.replaceState({}, '', '/');
    }
    fetchTodos();
  }, []);

  async function fetchTodos() {
    setLoading(true);
    const data = await getTodos();
    setTodos(data as Todo[]);
    setLoading(false);
  }

  async function toggleTodo(id: string, currentStatus: string) {
    const newStatus = currentStatus === 'complete' ? 'pending' : 'complete';
    const { ok } = await updateTodoStatus(id, newStatus);
    if (ok) {
      setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, status: newStatus } : t)));
    }
  }

  async function runScan() {
    setScanning(true);
    try {
      const data = await triggerScan();
      if (data.success) {
        setLastScan(`Scanned ${data.emailsProcessed} emails, found ${data.todosCreated} new to-dos`);
        await fetchTodos();
      } else {
        setLastScan(`Error: ${data.error}`);
      }
    } catch {
      setLastScan('Scan failed.');
    }
    setScanning(false);
  }

  const filteredTodos = todos.filter((t) => {
    const statusMatch = filter === 'all' || t.status === filter;
    const categoryMatch = categoryFilter === 'all' || t.category === categoryFilter;
    return statusMatch && categoryMatch;
  });

  const categories = ['all', ...Array.from(new Set(todos.map((t) => t.category).filter(Boolean)))];
  const pendingCount = todos.filter((t) => t.status === 'pending').length;
  const highPriorityCount = todos.filter((t) => t.status === 'pending' && t.priority === 'high').length;

  return (
    <div style={{ minHeight: '100vh', background: '#0F0F0F', color: '#F5F0E8', fontFamily: 'Georgia, serif' }}>
      <div style={{ borderBottom: '1px solid #2A2A2A', padding: '24px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#141414' }}>
        <div>
          <div style={{ fontSize: '11px', letterSpacing: '3px', color: '#8A7A6A', textTransform: 'uppercase', marginBottom: '4px' }}>Hoeken Design Build</div>
          <h1 style={{ fontSize: '22px', fontWeight: 'normal', margin: 0 }}>Reid&apos;s Action Items</h1>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <a href="/auth/gmail" style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #3A3A3A', color: '#8A7A6A', borderRadius: '4px', fontSize: '12px', textDecoration: 'none', letterSpacing: '1px' }}>
            Connect Gmail
          </a>
          <button onClick={runScan} disabled={scanning} style={{ padding: '8px 20px', background: scanning ? '#2A2A2A' : '#C8A96A', border: 'none', color: scanning ? '#666' : '#0F0F0F', borderRadius: '4px', fontSize: '12px', cursor: scanning ? 'not-allowed' : 'pointer', fontWeight: 'bold', letterSpacing: '1px' }}>
            {scanning ? 'Scanning...' : 'Scan Now'}
          </button>
        </div>
      </div>

      <div style={{ padding: '16px 40px', background: '#141414', borderBottom: '1px solid #2A2A2A', display: 'flex', gap: '32px', alignItems: 'center' }}>
        <div><span style={{ fontSize: '24px', color: '#C8A96A' }}>{pendingCount}</span><span style={{ fontSize: '12px', color: '#8A7A6A', marginLeft: '8px', letterSpacing: '1px' }}>PENDING</span></div>
        <div><span style={{ fontSize: '24px', color: '#E85D4A' }}>{highPriorityCount}</span><span style={{ fontSize: '12px', color: '#8A7A6A', marginLeft: '8px', letterSpacing: '1px' }}>HIGH PRIORITY</span></div>
        <div><span style={{ fontSize: '24px', color: '#4A9E6B' }}>{todos.filter((t) => t.status === 'complete').length}</span><span style={{ fontSize: '12px', color: '#8A7A6A', marginLeft: '8px', letterSpacing: '1px' }}>COMPLETED</span></div>
        {lastScan && <div style={{ marginLeft: 'auto', fontSize: '12px', color: '#8A7A6A' }}>{lastScan}</div>}
        {successMessage && <div style={{ marginLeft: 'auto', fontSize: '12px', color: '#4A9E6B' }}>{successMessage}</div>}
      </div>

      <div style={{ padding: '20px 40px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {(['pending', 'all', 'complete'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 14px', background: filter === f ? '#C8A96A' : 'transparent', border: `1px solid ${filter === f ? '#C8A96A' : '#3A3A3A'}`, color: filter === f ? '#0F0F0F' : '#8A7A6A', borderRadius: '3px', fontSize: '11px', cursor: 'pointer', letterSpacing: '1px', textTransform: 'uppercase' }}>{f}</button>
        ))}
        <div style={{ width: '1px', background: '#2A2A2A', margin: '0 8px' }} />
        {categories.map((cat) => (
          <button key={cat} onClick={() => setCategoryFilter(cat)} style={{ padding: '6px 14px', background: categoryFilter === cat ? '#2A2A2A' : 'transparent', border: `1px solid ${categoryFilter === cat ? '#4A4A4A' : '#2A2A2A'}`, color: categoryFilter === cat ? '#F5F0E8' : '#5A5A5A', borderRadius: '3px', fontSize: '11px', cursor: 'pointer', letterSpacing: '1px', textTransform: 'uppercase' }}>{cat === 'all' ? 'All Categories' : cat}</button>
        ))}
      </div>

      <div style={{ padding: '0 40px 40px' }}>
        {loading ? (
          <div style={{ color: '#8A7A6A', padding: '40px 0', textAlign: 'center', fontSize: '14px' }}>Loading...</div>
        ) : filteredTodos.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', border: '1px dashed #2A2A2A', borderRadius: '8px', color: '#5A5A5A' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>📭</div>
            <div style={{ fontSize: '14px' }}>No action items found.</div>
            <div style={{ fontSize: '12px', marginTop: '8px', color: '#3A3A3A' }}>Connect Gmail and run a scan to get started.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {filteredTodos.map((todo) => (
              <div key={todo.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', padding: '16px 20px', background: todo.status === 'complete' ? '#141414' : '#1A1A1A', borderRadius: '6px', border: `1px solid ${todo.status === 'complete' ? '#1E1E1E' : '#252525'}`, opacity: todo.status === 'complete' ? 0.6 : 1 }}>
                <button onClick={() => toggleTodo(todo.id, todo.status)} style={{ width: '20px', height: '20px', minWidth: '20px', borderRadius: '50%', border: `2px solid ${todo.status === 'complete' ? '#4A9E6B' : PRIORITY_COLORS[todo.priority] || '#3A3A3A'}`, background: todo.status === 'complete' ? '#4A9E6B' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '2px', flexShrink: 0 }}>
                  {todo.status === 'complete' && <span style={{ color: '#fff', fontSize: '11px' }}>✓</span>}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', color: todo.status === 'complete' ? '#5A5A5A' : '#F5F0E8', textDecoration: todo.status === 'complete' ? 'line-through' : 'none', marginBottom: '6px', lineHeight: '1.5' }}>{todo.task}</div>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: '#5A5A5A' }}>{CATEGORY_ICONS[todo.category] || '📌'} {todo.category}</span>
                    <span style={{ fontSize: '11px', color: '#3A3A3A' }}>•</span>
                    <span style={{ fontSize: '11px', color: '#5A5A5A', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{todo.source_email_subject}</span>
                    <span style={{ fontSize: '11px', color: '#3A3A3A' }}>•</span>
                    <span style={{ fontSize: '11px', color: '#5A5A5A' }}>{todo.source_email_date ? new Date(todo.source_email_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</span>
                  </div>
                </div>
                <div style={{ padding: '3px 10px', borderRadius: '3px', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', color: PRIORITY_COLORS[todo.priority] || '#8A7A6A', border: `1px solid ${PRIORITY_COLORS[todo.priority] || '#3A3A3A'}`, opacity: 0.8, flexShrink: 0 }}>{todo.priority}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}