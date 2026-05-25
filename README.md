# Mística App & WhatsApp Marketing Gateway

This repository contains the administrative portal for **Mística Natación & Aquagym**, featuring real-time attendance, billing, sales, and automated marketing campaigns through the WhatsApp Web gateway.

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
5. Define environment variables in Coolify for WAHA:
   - `WHATSAPP_API_KEY`: set this to a secure secret token (aligned with `WAHA_API_KEY` in Next.js).
   - `WAHA_SESSIONS_PERSISTENCE`: `true` to ensure logins persist.
6. Trigger the deployment.

---

### 📲 QR Code Login Flow

1. Navigate to the `/mkt` dashboard (protected under Password Gate authorization).
2. If disconnected, click **Iniciar sesión de WhatsApp**. This triggers a session named `default` (standard session supported by WAHA Core).
3. If pairing is required, click **Actualizar Código QR** to render the WhatsApp Web pairing QR Code.
4. Open WhatsApp on your mobile phone &gt; **Linked Devices** &gt; **Link a Device** and scan the rendered code.
5. Once connected, status transitions to `Conectado (WORKING)` and you are ready to prepare campaigns.

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
