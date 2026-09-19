# Permintaan Fitur & Perbaikan

Catatan permintaan pengembangan aplikasi Director Assistant (Naya).

**Cara catatan ini diisi.** Para direktur mengobrol dengan Naya lewat WhatsApp, bukan dengan
pengembang — jadi permintaan mereka tidak pernah sampai ke sini dengan sendirinya. Isinya
dikumpulkan dengan menyisir `ai_usage_logs.command` (teks perintah WA) dan keluhan yang muncul di
percakapan, lalu diringkas ke tabel di bawah. Penyisiran dilakukan saat diminta, bukan otomatis
berjalan — jadi kalau ada jeda panjang tanpa update, artinya belum disisir, bukan berarti tidak ada
permintaan.

Perintah penyisiran:

```sql
select to_char(created_at + interval '7 hours','DD/MM HH24:MI') as wib, command
from ai_usage_logs
where user_id = '<id direktur>' and created_at > now() - interval '14 days'
order by created_at;
```

---

## Selesai

| # | Permintaan | Dari | Bukti | Status |
|---|---|---|---|---|
| 1 | Pengingat dengan jeda khusus ("ingatkan 3 jam sebelumnya", "1 hari sebelumnya") | Pak Alfan | Diminta **5x**: 11/09 (2x), 14/09, 15/09, 16/09 | ✅ `48d5435` — kolom `remind_before_minutes` |
| 2 | Perubahan jadwal tanpa ditanya berulang | Pak Alfan | 12/09 & 15/09 — instruksi lengkap tetap ditanya 2-3x | ✅ `def7577` — tool `update_schedule` |
| 3 | Jadwal kembar tidak menggantung setelah ditandai selesai | Pak Alfan | 15/09 → masih ditanya lagi 17/09 | ✅ `48d5435` |
| 4 | Gombalan bisa dimatikan | (ditemukan saat audit) | Terkirim 4-6x/hari tanpa pernah ditawari | ✅ `9ec2c04` — default mati untuk akun baru |
| 5 | Pertanyaan "kerjaan yang belum selesai" menjawab seluruh tanggungan | Mas Ony | Hanya menjawab Task, follow-up & jadwal terlewat | ✅ `a6ec364` — tool `get_all_open_work` |

## Belum dikerjakan

| # | Permintaan | Asal | Kenapa penting | Perkiraan |
|---|---|---|---|---|
| 6 | **Cek bentrok saat mengubah jadwal** | Celah dari #2 | `create_schedule` menolak jadwal bentrok, `update_schedule` tidak — memindahkan acara ke jam yang sudah terisi tidak diperingatkan. Perlu mengecualikan jadwal itu sendiri dari pengecekan, kalau tidak ia bentrok dengan versi lamanya | ~15 menit |
| 7 | **Pemantau sesi WhatsApp** | Mas Ony | Nomor bersama mati seminggu lebih tanpa ada yang tahu sampai dicek manual. Cek `/api/sessions/status` berkala, kabari kalau bukan `READY` | ~30 menit |
| 8 | **Turunkan volume pesan motivasi** | Pencegahan blokir | Motivasi masih 6x/hari (06-21, tiap 3 jam). Belum terasa karena belum ada direktur yang mengisi daftar motivasinya — akan langsung terasa begitu ada | ~5 menit |
| 9 | **Hapus kolom `notify_priority_alert`** | Sisa `9ec2c04` | UI & API-nya sudah dicabut; kolomnya sengaja ditinggal agar container lama tidak error saat rolling deploy. Aman di-drop setelah deploy stabil | ~5 menit |
| 10 | **Biaya AI per direktur untuk penagihan** | Mas Ony | Tabel rekapnya sudah ada, tapi angkanya dipengaruhi cache bersama: direktur yang kebetulan chat setelah yang lain membayar lebih murah. Perlu diputuskan apakah ditagih apa adanya atau diratakan | perlu keputusan |

---

## Catatan pola dari pemakaian nyata

**Permintaan yang diulang berkali-kali = fitur yang tidak ada, bukan pengguna yang cerewet.**
Pengingat jeda khusus diminta 5 kali dalam 6 hari sebelum ketahuan bahwa sistemnya memang tidak
punya kolom untuk menyimpannya. Pola "pengguna mengulang permintaan yang sama" layak diperlakukan
sebagai sinyal celah fitur.

**Pengguna cenderung menyalahkan diri sendiri.** Saat Naya menanyakan jadwal yang sudah lama
beres (akibat duplikat yang menggantung), Pak Alfan menjawab *"iya saya salah"* — padahal dia
benar. Keluhan yang terdengar seperti kesalahan pengguna perlu ditelusuri ke datanya dulu.

**`status = success` di `agent_runs` tidak berarti hasilnya benar.** Semua 49 tool call Pak Alfan
berstatus sukses selama minggu pertama, sementara tiga bug di atas sedang aktif merusak datanya.
Status itu hanya berarti tool-nya jalan tanpa exception.
