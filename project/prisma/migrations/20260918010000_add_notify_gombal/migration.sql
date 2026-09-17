ALTER TABLE "users" ADD COLUMN "notify_gombal" BOOLEAN NOT NULL DEFAULT false;
-- Pemilik workspace yang sudah ada tetap menerima seperti sebelumnya; hanya direktur BARU
-- yang mulai dari mati. Tanpa baris ini, fitur yang sedang dipakai mendadak hilang diam-diam.
UPDATE "users" SET "notify_gombal" = true WHERE "is_owner" = true;
