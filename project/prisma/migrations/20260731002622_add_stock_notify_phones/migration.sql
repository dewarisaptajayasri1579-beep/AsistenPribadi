-- AlterTable
ALTER TABLE "users" ADD COLUMN     "notify_stock_market" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stock_notify_phone_1" TEXT,
ADD COLUMN     "stock_notify_phone_2" TEXT;

-- CreateTable
CREATE TABLE "stock_watches" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "company_name" TEXT,
    "target_price" DOUBLE PRECISION,
    "buy_price" DOUBLE PRECISION,
    "target_percent" DOUBLE PRECISION,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_alert_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_watches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_price_logs" (
    "id" TEXT NOT NULL,
    "stock_watch_id" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_price_logs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "stock_watches" ADD CONSTRAINT "stock_watches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_price_logs" ADD CONSTRAINT "stock_price_logs_stock_watch_id_fkey" FOREIGN KEY ("stock_watch_id") REFERENCES "stock_watches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
