# WAHUB API — Dokumentasi

Dokumentasi API WhatsApp gateway WAHUB (self-hosted milik Ony) untuk keperluan reminder WhatsApp di Director Daily Assistant (Tahap 5).

**Base URL:** `https://backend-wahub.onyseven.com` — sudah dites langsung dan aktif (sesi WhatsApp berstatus `READY`, terhubung ke `62859300...`).

---

## Autentikasi

Semua request ke API eksternal wajib menyertakan Client API Key di header. Sistem otomatis menambahkan prefix `sessionId` dengan Client ID Anda.

```text
Headers:
"x-api-key": "YOUR_CLIENT_API_KEY"
```

---

## Session Management

### `POST /api/sessions/start`

Inisialisasi sesi WhatsApp baru. Setelah memanggil ini, gunakan endpoint QR untuk scan.

**Body:**
```json
{ "webhookUrl": "https://your-app.com/webhook" }
```
`webhookUrl` bersifat opsional.

### `POST /api/sessions/webhook` *(ditambahkan khusus untuk Director Daily Assistant)*

Update `webhookUrl` sesi yang **sudah aktif/READY** tanpa restart atau logout — `POST /api/sessions/start` tidak bisa dipakai untuk ini karena jadi no-op kalau sesinya sudah jalan.

**Body:**
```json
{ "webhookUrl": "https://assistant.onyseven.com/api/whatsapp/webhook?secret=WAHUB_WEBHOOK_SECRET" }
```

Panggil sekali saja (cukup dari terminal/Postman, bukan dari kode aplikasi) untuk mengaktifkan fitur "chat AI Assistant lewat WhatsApp":
```bash
curl -X POST https://backend-wahub.onyseven.com/api/sessions/webhook \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_CLIENT_API_KEY" \
  -d '{ "webhookUrl": "https://assistant.onyseven.com/api/whatsapp/webhook?secret=WAHUB_WEBHOOK_SECRET" }'
```
Ganti `WAHUB_WEBHOOK_SECRET` dengan nilai env var yang sama di Coolify.

### Webhook pesan masuk (format payload dari WAHUB ke `webhookUrl`)

Setiap ada pesan WhatsApp masuk/keluar di sesi ini, WAHUB POST payload berikut ke `webhookUrl`:
```json
{
  "sessionId": "clientId-default",
  "message": {
    "from": "628xxxxxxxxx@s.whatsapp.net",
    "to": "me",
    "body": "isi pesannya",
    "type": "conversation",
    "hasMedia": false,
    "timestamp": 1735000000
  }
}
```
- `to: "me"` berarti pesan ini benar-benar **masuk** dari orang lain (bukan pesan yang kita kirim sendiri) — Director Daily Assistant memakai field ini untuk membedakan, supaya balasan bot sendiri tidak diproses ulang.
- Tidak ada header autentikasi di request webhook ini — proteksinya lewat query param `?secret=...` yang kita tentukan sendiri di `webhookUrl`.

### `GET /api/sessions/qr`

Mengembalikan tag `<img>` HTML berisi QR Code untuk login WhatsApp Web.

### `GET /api/sessions/status`

Cek status koneksi sesi. Kemungkinan nilai: `starting`, `qr_ready`, `ready`, `failed`.

---

## Messaging

### `POST /api/messages/send`

Kirim pesan teks ke nomor tertentu (wajib sertakan kode negara, contoh: `62812...`).

**Body:**
```json
{ "number": "6281234567890", "message": "Hello from WAHUB API!" }
```

### `POST /api/messages/send-media`

Kirim gambar/dokumen lewat URL dengan caption opsional.

**Body:**
```json
{
  "number": "6281234567890",
  "mediaUrl": "https://example.com/image.jpg",
  "caption": "Check out this image!"
}
```

---

## Contoh Kode

### cURL (Terminal / PHP)

```bash
curl -X POST https://backend-wahub.onyseven.com/api/messages/send \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_CLIENT_API_KEY" \
  -d '{ "number": "6281234567890", "message": "Pesan dari cURL!" }'
```

### JavaScript (Fetch API)

```javascript
fetch("https://backend-wahub.onyseven.com/api/messages/send", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": "YOUR_CLIENT_API_KEY",
  },
  body: JSON.stringify({ number: "6281234567890", message: "Pesan dari Fetch API!" }),
})
  .then((res) => res.json())
  .then((data) => console.log(data))
```

### Node.js (Axios)

```javascript
const axios = require("axios")

axios
  .post(
    "https://backend-wahub.onyseven.com/api/messages/send",
    { number: "6281234567890", message: "Pesan dari Axios Node.js!" },
    { headers: { "x-api-key": "YOUR_CLIENT_API_KEY" } }
  )
  .then((response) => console.log(response.data))
  .catch((error) => console.error(error))
```

---

## Catatan integrasi ke Director Daily Assistant

- API key sudah tersimpan di `project/.env` sebagai `WAHUB_API_KEY`, base URL sebagai `WAHUB_BASE_URL`.
- Sesi WhatsApp **sudah aktif** (status `READY`) — tidak perlu ulang proses scan QR untuk mulai kirim reminder.
- Sudah dites nyata: kirim pesan ke `6285930019565` berhasil (`success: true`, `status: PENDING`).
- Untuk reminder terjadwal (Tahap 5), backend tinggal panggil `POST /api/messages/send` langsung — tidak perlu setup ulang sesi selama status tetap `READY`.
