CREATE TABLE "delegations" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "contact_name" TEXT NOT NULL,
  "contact_phone" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "notes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'menunggu',
  "reminded_count" INTEGER NOT NULL DEFAULT 0,
  "last_reminded_at" TIMESTAMP(3),
  "last_reply_at" TIMESTAMP(3),
  "opted_out" BOOLEAN NOT NULL DEFAULT false,
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "delegations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "delegations_contact_phone_idx" ON "delegations"("contact_phone");
ALTER TABLE "delegations" ADD CONSTRAINT "delegations_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
