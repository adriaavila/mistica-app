# Mística App & WhatsApp Marketing Gateway

Administrative portal for **Mística Natación & Aquagym**: real-time attendance, billing, sales,
and automated WhatsApp marketing campaigns.

**Live:** https://mistica-app-fawn.vercel.app · **Category:** Web app · automation · **Status:** in production

## The problem

A swim school runs on two lists that never match: who actually showed up to class, and who has
actually paid. Re-engaging lapsed students means one person copy-pasting WhatsApp messages for an
afternoon — and messaging the same family three times because siblings sit in three rows.

## What it does

- Real-time attendance per class, billing and sales in one portal.
- **WhatsApp campaign dispatcher** (`/mkt`) — throttled, targeted at active students, and it
  **merges sibling names into a single greeting** so one family gets one message.
- `MKT_DRY_RUN` mode so a campaign can be rehearsed before a single real message goes out.
- Self-hosted WAHA gateway (Docker/Coolify), server-side only — credentials never reach the client bundle.

Why it's in the portfolio: the automation is the product. Attendance data drives who gets
messaged, so the marketing is a consequence of the operation instead of a separate chore.

---

## 🚀 Getting Started

### 1. Installation
Install project dependencies:
```bash
npm install
```

### 2. Run Locally
Start Next.js (front-end) and Convex (real-time back-end) concurrently:
```bash
npm run dev
```

### 3. Verification
Verify type safety and execute unit/integration tests:
```bash
# Type Check
npx tsc --noEmit

# Run Tests
npm run test
```

---

## 📣 WhatsApp Marketing Campaigns (`/mkt`)

We have integrated a secure, throttled WhatsApp marketing dispatcher to communicate with active students and sibling groups (automatically merging sibling names in the message greetings).

### ⚙️ Environment Variables (`.env.local` / Coolify)

Configure these environment variables in your deployment environment:

| Variable | Description | Example |
|---|---|---|
| `NEXT_PUBLIC_CONVEX_URL` | Client endpoint for Convex database. | `https://your-convex-subdomain.convex.cloud` |
| `CONVEX_DEPLOY_KEY` | Deployment credential key for Convex. | `prod:...` |
| `WAHA_BASE_URL` | Base URL endpoint for the WAHA API service. | `http://vps-ip:3000` |
| `WAHA_API_KEY` | Secret api key configuration for WAHA API auth. | `your-secure-key` |
| `MKT_DRY_RUN` | Simulation mode. When `true`, WhatsApp sends are mocked and bypassed. | `false` |

> [!WARNING]
> Do NOT expose `WAHA_API_KEY` or `WAHA_BASE_URL` with `NEXT_PUBLIC_` prefixes. These values must remain strictly on the server-side (`src/lib/server/waha.ts`) to avoid leaking authorization credentials to client bundles.

---

### 🐳 Deploying WAHA in Coolify

To run the WhatsApp automation gateway:
1. In Coolify, create a new **Docker Compose** or **Docker Image** application.
2. Use the official WAHA image: `devlikeapro/waha` (Core version).
3. Expose port `3000` (mapped to internal container port `3000`).
4. Configure volume mapping to persist sessions between service restarts:
   - Map `/data` inside the container to a persistent path on your host system (e.g. `./waha-data:/data`).
5. Define the gateway authentication variables in Coolify:
   - `WAHA_API_KEY_HASH`: SHA-512 hash of the same secret configured as `WAHA_API_KEY` in Next.js/Vercel.
   - `WAHA_SESSIONS_PERSISTENCE`: `true` to ensure logins persist.
6. Trigger the deployment.

---

### 📲 QR Code Login Flow

1. Navigate to the `/mkt` dashboard (protected under Password Gate authorization).
2. If disconnected, open `/mkt` and expand **Conexión de WhatsApp**. WAHA uses the single supported session named `default`.
3. Choose **Vincular mediante código**, enter the Business phone number, and request the code. In WhatsApp, open **Dispositivos vinculados** → **Vincular con número de teléfono** and enter it.
4. If the code is unavailable, choose **Vincular con QR** and scan it from WhatsApp → **Dispositivos vinculados** → **Vincular dispositivo**.
5. Once connected, status transitions to `WORKING` and you are ready to prepare campaigns.

---

### 🛡️ Safety Controls & Sending Batches

To safeguard your WhatsApp account against spam flags or suspensions, we enforce strict programmatic controls:
- **Campaign Concurrency Lock**: Prevents multiple concurrent batch sends on the same campaign, protecting against double-clicks.
- **Manual Pause Guard**: Admins can pause campaigns directly in the UI. If a campaign is `"paused"`, all batch triggers are blocked.
- **Strict Deduplication**: Prior to queuing, the database double-checks all messages. No phone number will ever have more than one pending or sent message in the same campaign.
- **Throttling & Batch Limits**: Sends are limited to a maximum of 25 messages per batch (defaulting to 10).
- **Human Delay Simulation**: Introduces a random sleep of **25 to 60 seconds** between messages to simulate standard human interaction.

---

### ⚠️ Risks of Unofficial WhatsApp Web Automation

Because WAHA operates by automating a headless browser logged into WhatsApp Web, please observe the following risks and best practices:

1. **Unofficial API Bans**:
   - WhatsApp strictly prohibits unofficial automation. Sending messages in rapid succession, using repetitive generic templates, or sending to numbers that do not have your contact saved may lead to temporary or permanent phone line suspension.
2. **Preventative Actions**:
   - Limit dispatch batches to under 100 per day.
   - Restrict recipients to active clients who expect communication.
   - Keep the random delays active.
   - Use Venezuelan/Bolivian local numbers appropriately and ensure they are formatted properly (`58412...` / `5917...`).
3. **Session Persistence**:
   - Although the session survives Next.js app redeploys (since WAHA is a separate service), the session token on your phone may be logged out by WhatsApp if the server remains inactive for too long. Periodically check `/mkt` status.

---

**Built by [creativ3](https://allok.fun)** — software and automation for businesses.
[See the portfolio](https://allok.fun/projects) · [Request a quote](https://allok.fun/cotizar)
