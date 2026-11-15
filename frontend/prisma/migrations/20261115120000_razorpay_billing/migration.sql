ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "razorpay_subscription_id" VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS "users_razorpay_subscription_id_key" ON "users"("razorpay_subscription_id");

CREATE TABLE IF NOT EXISTS "razorpay_webhook_events" (
  "id" TEXT PRIMARY KEY,
  "type" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
