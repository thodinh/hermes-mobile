# Hermes Mobile

Tauri 2 mobile chat client for Hermes Dashboard JSON-RPC WebSocket (`/api/ws`). No PTY.

## MVP

- Native mobile chat layout, streaming response, sessions
- Dashboard password login, short-lived WebSocket ticket
- Android/iOS CI artifacts via GitHub Actions

## Server

Expose `hermes dashboard` safely: HTTPS, auth enabled. The client expects the Dashboard password provider and `POST /api/auth/ws-ticket`.

## Local

```bash
npm ci
node --test tests/protocol.test.mjs
npm run build
```

Mobile builds run only in GitHub Actions. iOS artifacts are unsigned debug builds; distribution requires Apple signing.

## Security ceiling

The MVP uses browser-cookie login to mint a WS ticket. Validate cookie behavior in actual Android/iOS WebViews before release. If cross-origin cookies are rejected, use Hermes native PKCE token flow and OS keychain storage.
