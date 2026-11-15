-- Razorpay subscriptions (BILLING_PROVIDER=razorpay). The user row keeps the
-- current Razorpay subscription so webhooks for older ones are ignored.
ALTER TABLE users ADD COLUMN IF NOT EXISTS razorpay_subscription_id VARCHAR(255) UNIQUE;

CREATE TABLE IF NOT EXISTS razorpay_webhook_events (
    id VARCHAR(255) PRIMARY KEY,
    type VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
