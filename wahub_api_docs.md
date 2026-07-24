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
