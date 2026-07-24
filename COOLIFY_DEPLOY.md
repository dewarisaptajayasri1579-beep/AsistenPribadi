# Deploy ke Coolify

Aplikasi sudah punya `Dockerfile` di `project/Dockerfile`, siap dipakai Coolify (mode "Dockerfile" bukan Nixpacks).

## Langkah di Coolify

1. **New Resource → Application → Docker Build (Dockerfile)**
2. Hubungkan ke repo GitHub `AsistenPribadi`, pilih branch `main`
3. **Base Directory**: `director_assistent_agent/project` (karena Dockerfile ada di dalam folder itu, bukan di root repo)
4. **Port**: `3000`

## Environment Variables (wajib diisi di Coolify)

```env
DATABASE_URL=postgresql://postgres.felporpedpungwgwunrt:<password>@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.felporpedpungwgwunrt:<password>@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres
ANTHROPIC_API_KEY=sk-ant-...
WAHUB_API_KEY=...
WAHUB_BASE_URL=https://backend-wahub.onyseven.com
NODE_ENV=production
```

Salin nilai aslinya dari `project/.env` lokal (jangan commit file itu ke git — sudah di-gitignore).

## Catatan penting

- **Cron jalan di dalam proses Node** (pakai `node-cron`, lihat `instrumentation.ts`) — ini butuh container yang **selalu hidup** (bukan serverless). Coolify cocok karena menjalankan container persisten, tapi pastikan **hanya 1 instance/replica** yang jalan, supaya cron (reminder WhatsApp, briefing pagi, evaluasi malam) tidak terkirim dobel kalau di-scale ke banyak instance.
- Database masih pakai Supabase yang sama seperti development — tidak perlu database baru, cukup pastikan `DATABASE_URL`/`DIRECT_URL` di Coolify sama dengan yang di lokal.
- Setelah deploy pertama kali, buka `https://<domain-coolify-kamu>/register` dan daftar pakai email `onysaptanugraha@gmail.com` untuk "klaim" akun direktur yang sudah ada (set password baru). User lain (sekretaris, tim) juga daftar lewat halaman yang sama dengan email masing-masing.
- Isi nomor WhatsApp di menu **Pengaturan** supaya reminder & briefing otomatis bisa terkirim.
