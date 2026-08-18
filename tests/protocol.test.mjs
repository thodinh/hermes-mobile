import assert from 'node:assert/strict';

const request = (id, method, params = {}) => ({ jsonrpc: '2.0', id, method, params });
const wsUrl = (url) => { const base = new URL(url.trim()); base.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:'; base.pathname = `${base.pathname.replace(/\/$/, '')}/api/ws`; return base.toString(); };

assert.deepEqual(request(7, 'session.create', { source: 'mobile' }), { jsonrpc: '2.0', id: 7, method: 'session.create', params: { source: 'mobile' } });
assert.equal(request(8, 'prompt.submit', { session_id: 'abc', text: 'Hi' }).params.text, 'Hi');
assert.equal(wsUrl('https://example.com/'), 'wss://example.com/api/ws');
assert.equal(wsUrl('http://127.0.0.1:9119'), 'ws://127.0.0.1:9119/api/ws');
console.log('protocol assertions passed');
