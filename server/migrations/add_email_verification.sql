-- Database Migration: Email Verification System
-- File: server/migrations/add_email_verification.sql

-- Step 1: Add verification columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_sent_at TIMESTAMP;

-- Step 2: Create email verification tokens table
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  token VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  verified_at TIMESTAMP,
  is_used BOOLEAN DEFAULT FALSE
);

-- Step 3: Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_verification_tokens_token ON email_verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_user_id ON email_verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_email ON email_verification_tokens(email);
CREATE INDEX IF NOT EXISTS idx_users_is_verified ON users(is_verified);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Step 4: Mark any existing users as verified (for backwards compatibility)
UPDATE users SET is_verified = TRUE WHERE is_verified IS NULL;

-- Done!
-- Run this file with: psql -U postgres -d ucca -f server/migrations/add_email_verification.sql
