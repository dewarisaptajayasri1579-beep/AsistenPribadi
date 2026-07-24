# Panduan Pembangunan — Director Daily Assistant

Dokumen ini menerjemahkan konsep di [idea.txt](idea.txt) menjadi langkah kerja yang bisa langsung dieksekusi, tahap demi tahap.

---

## 0. Prasyarat

Sebelum mulai, siapkan akun/akses berikut:

- [ ] Node.js 20+ terpasang
- [ ] Akun [Supabase](https://supabase.com) (Postgres + auth)
- [ ] API key [Claude (Anthropic)](https://console.anthropic.com)
- [ ] Akun [Vercel](https://vercel.com) untuk deploy
- [ ] Akun/API [wahub.com](https://wahub.com) (milik sendiri) untuk WhatsApp API (bisa ditunda sampai Tahap 5)
- [ ] Editor + CLI Git

---

## 1. Setup Proyek Awal

```bash
npx create-next-app@latest director-assistant --typescript --tailwind --app
cd director-assistant
npm install prisma @prisma/client @anthropic-ai/sdk
npx prisma init
```

Isi `.env`:

```env
DATABASE_URL="postgresql://...supabase..."
ANTHROPIC_API_KEY="sk-ant-..."
WAHUB_API_KEY=""    # diisi nanti di Tahap 5
```

---

## 2. Skema Database (Prisma)

Terjemahkan 5 tabel dari idea.txt ke `prisma/schema.prisma`:

```prisma
model User {
  id        String   @id @default(uuid())
  name      String
  email     String   @unique
  timezone  String   @default("Asia/Jakarta")
  tasks     Task[]
  schedules Schedule[]
  followUps FollowUp[]
  agentRuns AgentRun[]
}

model Task {
  id          String    @id @default(uuid())
  userId      String
  title       String
  description String?
  dueDate     DateTime?
  priority    String    @default("normal") // low | normal | high
  status      String    @default("todo")   // todo | in_progress | done | postponed
  category    String?
  createdAt   DateTime  @default(now())
  completedAt DateTime?
  user        User      @relation(fields: [userId], references: [id])
}

model Schedule {
  id       String   @id @default(uuid())
  userId   String
  title    String
  startAt  DateTime
  endAt    DateTime?
  location String?
  notes    String?
  status   String   @default("confirmed")
  user     User     @relation(fields: [userId], references: [id])
}

model FollowUp {
  id            String   @id @default(uuid())
  userId        String
  title         String
  relatedPerson String?
  dueDate       DateTime?
  status        String   @default("open") // open | done | overdue
  notes         String?
  user          User     @relation(fields: [userId], references: [id])
}

model AgentRun {
  id          String   @id @default(uuid())
  userId      String
  command     String
  agentAction String
  result      String?
  status      String   @default("success")
  createdAt   DateTime @default(now())
  user        User     @relation(fields: [userId], references: [id])
}
```

```bash
npx prisma migrate dev --name init
```

---

## Tahap 1 — Aplikasi Tugas Biasa (tanpa AI)

Tujuan: pastikan fondasi CRUD jalan sebelum menambah kecerdasan.

- [ ] Route `app/api/tasks/route.ts` — `GET` (list), `POST` (create)
- [ ] Route `app/api/tasks/[id]/route.ts` — `PATCH` (update/selesaikan), `DELETE`
- [ ] Halaman `app/tasks/page.tsx` — tabel tugas hari ini + form tambah manual
- [ ] Uji: tambah, ubah, selesaikan, lihat tugas hari ini — semua lewat UI biasa, belum ada chat

**Checkpoint:** aplikasi todo standar berjalan penuh tanpa AI sama sekali.

---

## Tahap 2 — Claude API Mengubah Bahasa Bebas Jadi Data Terstruktur

- [ ] Buat `lib/claude.ts` — client Anthropic SDK
- [ ] Buat endpoint `app/api/parse/route.ts`: terima teks bebas ("Ingatkan saya bayar server Jumat"), kirim ke Claude dengan instruksi mengembalikan JSON terstruktur (title, due_date, priority, category)
- [ ] Gunakan **structured output** (JSON schema di prompt atau `tool_choice` forced) supaya hasil selalu valid
- [ ] Simpan hasil parsing ke tabel `Task` via endpoint Tahap 1

**Checkpoint:** ketik kalimat bebas → tersimpan otomatis sebagai tugas terstruktur.

---

## Tahap 3 — Tool Calling Penuh (Agent Sesungguhnya)

Implementasikan 9 tools dari idea.txt sebagai fungsi backend yang dipanggil Claude via tool use:

```text
create_task            update_task           complete_task
create_schedule        check_schedule_conflict
get_today_tasks        get_overdue_tasks
create_follow_up       generate_daily_brief
```

- [ ] `lib/tools/` — satu file per tool, masing-masing fungsi murni yang baca/tulis Prisma
- [ ] `lib/tools/definitions.ts` — deklarasi skema tool untuk Claude (nama, deskripsi, parameter)
- [ ] `app/api/agent/route.ts` — loop agent: terima pesan user → kirim ke Claude dengan daftar tools → jika Claude minta tool, jalankan tool → kirim hasil balik ke Claude → ulangi sampai Claude memberi jawaban akhir teks
- [ ] Setiap pemanggilan tool dicatat ke tabel `AgentRun` (command, agent_action, result, status)
- [ ] Tanam system prompt "Instruksi Agent" dari idea.txt (6 aturan: jangan buat jadwal bentrok, prioritas tinggi untuk klien/pembayaran, jangan hapus tanpa persetujuan, dll)
- [ ] Halaman `app/assistant/page.tsx` — UI chat sederhana yang memanggil `/api/agent`

**Checkpoint:** demo skenario dari idea.txt jalan penuh — buat meeting, tanya agenda, pindahkan jadwal, semua lewat chat satu kotak.

---

## Tahap 4 — Briefing Pagi & Evaluasi Malam

- [ ] Tool `generate_daily_brief` — agregasi: jadwal hari ini, 3 prioritas, follow-up terlambat → format teks briefing
- [ ] Cron job (Vercel Cron atau `node-cron`) jam 07:00 → panggil briefing, simpan/tampilkan di Dashboard
- [ ] Cron job jam 20:00 (evaluasi malam) → hitung tugas selesai/belum/ditunda hari itu, ajukan pertanyaan "pindahkan ke besok?" (bisa via notifikasi in-app dulu sebelum WhatsApp)
- [ ] Halaman `app/dashboard/page.tsx` — tampilkan agenda, 3 prioritas, tugas terlambat, follow-up, ringkasan AI
- [ ] Halaman `app/report/page.tsx` — laporan harian (tugas selesai/belum, follow-up terlambat, agenda besok, rekomendasi AI)

**Checkpoint:** setiap pagi ada ringkasan otomatis; setiap malam ada evaluasi otomatis.

---

## Tahap 5 — Reminder WhatsApp via wahub.com

- [ ] Cron job tiap beberapa menit — cari `Schedule`/`Task` yang mendekati waktu jatuh tempo
- [ ] `lib/wahub.ts` — kirim pesan WhatsApp via API wahub.com
- [ ] Setelah kirim, log ke `AgentRun` (agent_action = "send_reminder")
- [ ] Uji end-to-end: buat jadwal dekat waktu sekarang → pastikan WhatsApp masuk tepat waktu

**Checkpoint:** MVP lengkap sesuai batas — 1 pengguna, 4 menu, 3+ tabel utama, 1 AI Agent, 6–8 tools, 1 notifikasi WhatsApp.

---

## 3. Skenario Uji Akhir (Demo)

Jalankan urutan ini sebagai smoke test sebelum dianggap selesai:

1. "Besok jam 10 meeting dengan Victor membahas AppMap." → agent cek bentrok → buat jadwal
2. "Apa agenda saya besok?" → agent baca & jawab
3. "Pindahkan meeting Victor ke jam 11." → agent temukan & update jadwal
4. Tunggu waktunya → pastikan reminder WhatsApp terkirim
5. Cek tabel `agent_runs` — semua langkah di atas harus tercatat

---

## 4. Deploy

```bash
vercel deploy
```

- [ ] Set semua env vars di dashboard Vercel (Supabase URL, Anthropic key, Wahub key)
- [ ] Set Vercel Cron untuk briefing pagi, evaluasi malam, dan pengecekan reminder

---

## 5. Setelah MVP Berhasil

Pola agent ini (parser → tools → tool loop → audit log) dipindahkan ke **AppMap AI Dependency** dengan mengganti isi `lib/tools/` saja:

```text
Director Assistant → AppMap AI
create_task         → create_node
create_schedule     → analyze_dependency
send_reminder       → update_documentation
                     → create_change_request
```

Fondasi (routing, tool loop, audit log, struktur Prisma) tetap dipakai ulang.
