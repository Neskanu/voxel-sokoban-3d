# Telegram Mini App Setup Guide

Crate Expectations (Voxel Sokoban 3D) runs natively as a **Telegram Mini App** with:
- Automatic Telegram WebApp detection (`js/adapters/telegram-adapter.js`)
- Mobile fullscreen (`requestFullscreen()`) with `safeAreaInset` + `contentSafeAreaInset` padding, and expanded desktop sheet (`expand()`)
- Vertical swipe lock (`disableVerticalSwipes()`) so 3D camera panning/tapping never closes the Mini App
- Chunked `Telegram.WebApp.CloudStorage` sync (supporting all 500 levels within Telegram's 4096-byte value limit)
- Native `HapticFeedback`, `BackButton`, and theme-matched header/background chrome
- Optional **Telegram Stars (`XTR`)** IAP invoice & restore hooks

---

## 1. Host the Static Bundle over HTTPS

1. Build the production bundle:
   ```bash
   npm run build
   ```
   This syntax-checks all modules and outputs `dist/web/` (plus `dist/voxel-sokoban-3d-telegram.zip`).
2. Deploy `dist/web/` to any HTTPS static host (Cloudflare Pages, Vercel, Netlify, GitHub Pages, or your own Nginx/Apache server).

---

## 2. Register in `@BotFather`

1. Open [@BotFather](https://t.me/BotFather) on Telegram.
2. Create or select your bot (`/newbot` or `/mybots`).
3. Configure the Menu Button or Mini App URL (`/setmenubutton` or `/newapp`) pointing to your HTTPS `dist/web/` URL.
4. Launch the Mini App inside Telegram mobile or Telegram Desktop.

---

## 3. Local Development & Testing

- **Default browser mode (`http://localhost:8080`)**: Uses `MockAdapter` with local `localStorage` and simulated dev controls because Telegram's `telegram-web-app.js` reports `platform: 'unknown'` and empty `initData` outside Telegram.
- **Force Telegram adapter in browser**: Open `http://localhost:8080/?platform=telegram` (or `?platform=telegram&apiBase=http://localhost:8787` to test Stars IAP locally).

---

## 4. Telegram Stars (`XTR`) IAP Backend Setup

By default `TELEGRAM_API_BASE` in `js/config.js` is `''`, so paid Telegram Stars buttons (`Go Pro`, `Unlock ... ★`, `Restore Purchases`) stay cleanly hidden and players unlock all packs via stars or Voxel Coins.

To enable **Telegram Stars (`XTR`)** purchases:

1. Set `TELEGRAM_API_BASE` in `js/config.js` (or inject `window.VOXEL_SOKOBAN_TELEGRAM_API_BASE = 'https://your-api.example.com'` before `platform.js` loads).
2. Run a backend bot server with two HTTPS endpoints:
   - `POST /api/telegram/create-invoice` → returns `{ "invoiceUrl": "https://t.me/$..." }`
   - `POST /api/telegram/entitlements` → returns `{ "entitlements": ["pro_unlock", ...] }`
3. Handle `pre_checkout_query` (must answer within 10 seconds) and `message.successful_payment` on your bot webhook/polling loop to persist verified entitlements by `user.id`.

### Product IDs (`js/config.js`)

| `productId` | Default Stars (`XTR`) | Unlocks |
| --- | --- | --- |
| `pro_unlock` | `250` | All 400 master levels, Pro cosmetics, 2× win coins, +500 welcome coins |
| `pack_neon_vault` | `100` | Neon Vault pack (100 levels) |
| `pack_frost_citadel` | `125` | Frost Citadel pack (100 levels) |
| `pack_sandstone_labyrinth` | `150` | Sandstone Labyrinth pack (100 levels) |
| `pack_grandmaster` | `175` | Grandmaster pack (100 levels) |

### Minimal Node.js Backend Reference

```js
// Requires Node 18+ (built-in fetch & crypto)
import crypto from 'node:crypto';
import http from 'node:http';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const PRODUCTS = {
  pro_unlock: { title: 'Crate Expectations Pro', description: 'All 400 master levels, Pro cosmetics, 2x win coins & +500 coins', stars: 250 },
  pack_neon_vault: { title: 'Neon Vault Pack', description: '100 tactical cyber-warehouse puzzles', stars: 100 },
  pack_frost_citadel: { title: 'Frost Citadel Pack', description: '100 precision ice-corridor challenges', stars: 125 },
  pack_sandstone_labyrinth: { title: 'Sandstone Labyrinth Pack', description: '100 tight desert-temple vaults', stars: 150 },
  pack_grandmaster: { title: 'Grandmaster Pack', description: '100 deep multi-stage logic chambers', stars: 175 }
};

// Replace with persistent DB in production
const userEntitlements = new Map();

function verifyInitData(initData) {
  const params = new URLSearchParams(initData || '');
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const computed = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  if (computed !== hash) return null;
  const user = JSON.parse(params.get('user') || 'null');
  return user && user.id ? user : null;
}

async function tgApi(method, payload) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.description || method);
  return json.result;
}

http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Telegram-Init-Data');
  if (req.method === 'OPTIONS') return res.writeHead(204).end();

  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
  const initData = req.headers['x-telegram-init-data'] || body.initData;

  if (req.url === '/api/telegram/create-invoice' && req.method === 'POST') {
    const user = verifyInitData(initData);
    const product = PRODUCTS[body.productId];
    if (!user || !product) return res.writeHead(400).end('Invalid request');

    const invoiceUrl = await tgApi('createInvoiceLink', {
      title: product.title,
      description: product.description,
      payload: JSON.stringify({ userId: user.id, productId: body.productId }),
      provider_token: '',
      currency: 'XTR',
      prices: [{ label: product.title, amount: product.stars }]
    });
    return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ invoiceUrl }));
  }

  if (req.url === '/api/telegram/entitlements' && req.method === 'POST') {
    const user = verifyInitData(initData);
    if (!user) return res.writeHead(401).end('Unauthorized');
    const entitlements = Array.from(userEntitlements.get(user.id) || []);
    return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ entitlements }));
  }

  if (req.url === '/api/telegram/webhook' && req.method === 'POST') {
    if (body.pre_checkout_query) {
      await tgApi('answerPreCheckoutQuery', { pre_checkout_query_id: body.pre_checkout_query.id, ok: true });
    }
    const payment = body.message && body.message.successful_payment;
    if (payment) {
      const { userId, productId } = JSON.parse(payment.invoice_payload);
      const set = userEntitlements.get(userId) || new Set();
      set.add(productId);
      userEntitlements.set(userId, set);
    }
    return res.writeHead(200).end('ok');
  }

  res.writeHead(404).end();
}).listen(8787);
```
