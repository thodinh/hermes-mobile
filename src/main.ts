type RpcResult<T = Record<string, unknown>> = { jsonrpc: '2.0'; id: number; result?: T; error?: { message: string } };
type RpcEvent = { method: 'event'; params: { type: string; session_id?: string; payload?: Record<string, unknown> } };
type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };
type StoredSession = { id: string; title: string; preview: string; message_count: number };

const app = document.querySelector<HTMLDivElement>('#app')!;
let socket: WebSocket | null = null;
let rpcId = 0;
let liveSessionId = '';
let messages: ChatMessage[] = [];
let streamed = '';
let settingsOpen = false;
let server = localStorage.getItem('hermes.server') ?? '';
let sessions: StoredSession[] = [];
let connected = false;

function serverUrl(url: string) { return url.trim().replace(/\/$/, ''); }
function wsUrl(url: string, ticket: string) { const base = new URL(serverUrl(url)); base.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:'; base.pathname = `${base.pathname}/api/ws`; base.searchParams.set('ticket', ticket); return base.toString(); }
function rpc(method: string, params: Record<string, unknown> = {}) { if (!socket || socket.readyState !== WebSocket.OPEN) throw new Error('Chưa kết nối server'); socket.send(JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params })); }
function escapeHtml(text: string) { const el = document.createElement('div'); el.textContent = text; return el.innerHTML; }

function render() {
  const transcript = messages.map((m) => `<article class="bubble ${m.role}">${escapeHtml(m.content)}</article>`).join('') + (streamed ? `<article class="bubble assistant streaming">${escapeHtml(streamed)}</article>` : '');
  app.innerHTML = `<header><button class="icon" id="sessions" aria-label="Phiên chat">☰</button><div><b>Hermes</b><small>${connected ? 'Đã kết nối' : 'Chưa kết nối'}</small></div><button class="icon" id="settings" aria-label="Cài đặt">⚙</button></header><section class="chat" id="chat">${transcript || '<div class="empty">Bắt đầu một cuộc trò chuyện.</div>'}</section><form class="composer" id="composer"><textarea id="prompt" rows="1" placeholder="Nhắn Hermes…" aria-label="Nội dung"></textarea><button id="send" type="submit" aria-label="Gửi">↑</button></form><aside class="sheet ${settingsOpen ? 'open' : ''}" id="sheet"><div class="grab"></div><h2>${sessions.length ? 'Phiên chat' : 'Kết nối Hermes'}</h2><form id="connect"><label>Dashboard URL<input id="server" inputmode="url" placeholder="https://hermes.example.com" value="${escapeHtml(server)}"></label><label>Tài khoản<input id="username" autocomplete="username" value="admin"></label><label>Mật khẩu<input id="password" type="password" autocomplete="current-password" placeholder="Không lưu trong app"></label><button>Kết nối</button></form><button class="secondary" id="new">Chat mới</button><div class="session-list">${sessions.map(s => `<button class="session" data-session="${escapeHtml(s.id)}"><b>${escapeHtml(s.title || 'Chat')}</b><small>${escapeHtml(s.preview || `${s.message_count} tin nhắn`)}</small></button>`).join('')}</div></aside><div class="scrim ${settingsOpen ? 'show' : ''}" id="scrim"></div>`;
  document.querySelector('#composer')?.addEventListener('submit', send); document.querySelector('#settings')?.addEventListener('click', () => { settingsOpen = true; render(); }); document.querySelector('#sessions')?.addEventListener('click', () => { settingsOpen = true; render(); }); document.querySelector('#scrim')?.addEventListener('click', () => { settingsOpen = false; render(); }); document.querySelector('#connect')?.addEventListener('submit', connect); document.querySelector('#new')?.addEventListener('click', newChat); document.querySelectorAll<HTMLButtonElement>('[data-session]').forEach(b => b.addEventListener('click', () => resume(b.dataset.session!))); document.querySelector<HTMLDivElement>('#chat')?.scrollTo({ top: 1e9 });
}

async function connect(event: Event) {
  event.preventDefault(); const url = document.querySelector<HTMLInputElement>('#server')!.value; const username = document.querySelector<HTMLInputElement>('#username')!.value; const password = document.querySelector<HTMLInputElement>('#password')!.value;
  try {
    const base = serverUrl(url);
    const login = await fetch(`${base}/auth/password-login`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: 'basic', username, password }) });
    if (!login.ok) throw new Error('Đăng nhập thất bại');
    const ticketResponse = await fetch(`${base}/api/auth/ws-ticket`, { method: 'POST', credentials: 'include' });
    const { ticket } = await ticketResponse.json() as { ticket?: string }; if (!ticket) throw new Error('Không lấy được vé kết nối');
    socket?.close(); socket = new WebSocket(wsUrl(base, ticket));
    socket.onopen = () => { server = base; localStorage.setItem('hermes.server', base); connected = true; settingsOpen = false; rpc('session.create', { source: 'mobile', cols: 40 }); rpc('session.list'); render(); };
    socket.onmessage = (e) => onFrame(JSON.parse(e.data)); socket.onclose = () => { connected = false; render(); }; socket.onerror = () => { streamed = 'Kết nối lỗi. Kiểm tra URL hoặc đăng nhập.'; render(); };
  } catch (error) { streamed = `Kết nối lỗi: ${error instanceof Error ? error.message : 'không xác định'}`; render(); }
}

function onFrame(frame: RpcResult | RpcEvent) { if ('result' in frame && frame.result) { const result = frame.result as Record<string, unknown>; if (typeof result.session_id === 'string') liveSessionId = result.session_id; if (Array.isArray(result.sessions)) { sessions = result.sessions as StoredSession[]; render(); } if (Array.isArray(result.messages)) { messages = result.messages as ChatMessage[]; streamed = ''; render(); } return; } if ('error' in frame && frame.error) { streamed = `Lỗi: ${frame.error.message}`; render(); return; } if (!('params' in frame)) return; const { type, session_id, payload = {} } = frame.params; if (session_id && session_id !== liveSessionId) return; if (type === 'message.delta') { streamed += String(payload.text ?? payload.delta ?? ''); render(); } if (type === 'message.complete' || type === 'turn.complete') { if (streamed) messages.push({ role: 'assistant', content: streamed }); streamed = ''; render(); } if (type === 'error') { streamed = `Lỗi: ${String(payload.message ?? 'Không xác định')}`; render(); } }
function newChat() { if (connected) { messages = []; streamed = ''; settingsOpen = false; rpc('session.create', { source: 'mobile', cols: 40 }); render(); } }
function resume(id: string) { rpc('session.resume', { session_id: id }); settingsOpen = false; render(); }
function send(event: Event) { event.preventDefault(); const input = document.querySelector<HTMLTextAreaElement>('#prompt')!; const text = input.value.trim(); if (!text || !liveSessionId) return; messages.push({ role: 'user', content: text }); input.value = ''; streamed = ''; rpc('prompt.submit', { session_id: liveSessionId, text }); render(); }
render();
