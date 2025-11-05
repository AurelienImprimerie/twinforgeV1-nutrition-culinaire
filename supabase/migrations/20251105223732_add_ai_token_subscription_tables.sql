/*
  # Add AI Analysis, Token Management and Subscription Tables

  1. New Tables
    - `ai_analysis_jobs`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to profiles)
      - `analysis_type` (text)
      - `request_payload` (jsonb)
      - `result_payload` (jsonb)
      - `input_hash` (text, for caching)
      - `status` (text: 'processing', 'completed', 'failed')
      - `error_message` (text, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `user_subscriptions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to profiles)
      - `stripe_subscription_id` (text, unique)
      - `stripe_customer_id` (text)
      - `status` (text: 'active', 'canceled', 'past_due', 'unpaid', 'trialing')
      - `plan_id` (text)
      - `current_period_start` (timestamptz)
      - `current_period_end` (timestamptz)
      - `cancel_at_period_end` (boolean, default false)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `ai_cost_analytics`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to profiles)
      - `edge_function_name` (text)
      - `operation_type` (text)
      - `openai_model` (text)
      - `openai_input_tokens` (integer)
      - `openai_output_tokens` (integer)
      - `openai_cost_usd` (numeric)
      - `tokens_charged` (integer)
      - `margin_multiplier` (numeric)
      - `revenue_usd` (numeric)
      - `profit_usd` (numeric)
      - `metadata` (jsonb)
      - `created_at` (timestamptz)

    - `user_token_balance`
      - `user_id` (uuid, primary key, foreign key to profiles)
      - `balance` (integer, default 0)
      - `monthly_refresh_amount` (integer, default 0)
      - `last_refresh_at` (timestamptz)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Users can read their own data
    - Service role can manage all data
    - Subscription webhooks need service role access

  3. Indexes
    - Index on user_id for all tables
    - Index on input_hash for ai_analysis_jobs (caching)
    - Index on stripe_subscription_id for user_subscriptions
    - Index on created_at for analytics queries
*/

-- Create ai_analysis_jobs table
CREATE TABLE IF NOT EXISTS ai_analysis_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  analysis_type text NOT NULL,
  request_payload jsonb NOT NULL,
  result_payload jsonb,
  input_hash text NOT NULL,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create user_subscriptions table
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_subscription_id text UNIQUE NOT NULL,
  stripe_customer_id text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'unpaid', 'trialing', 'incomplete', 'incomplete_expired')),
  plan_id text NOT NULL,
  current_period_start timestamptz NOT NULL,
  current_period_end timestamptz NOT NULL,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create ai_cost_analytics table
CREATE TABLE IF NOT EXISTS ai_cost_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  edge_function_name text NOT NULL,
  operation_type text NOT NULL,
  openai_model text NOT NULL,
  openai_input_tokens integer NOT NULL DEFAULT 0,
  openai_output_tokens integer NOT NULL DEFAULT 0,
  openai_cost_usd numeric(12, 6) NOT NULL DEFAULT 0.000000,
  tokens_charged integer NOT NULL DEFAULT 0,
  margin_multiplier numeric(6, 2) NOT NULL DEFAULT 1.00,
  revenue_usd numeric(12, 6) NOT NULL DEFAULT 0.000000,
  profit_usd numeric(12, 6) NOT NULL DEFAULT 0.000000,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create user_token_balance table
CREATE TABLE IF NOT EXISTS user_token_balance (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0,
  monthly_refresh_amount integer NOT NULL DEFAULT 0,
  last_refresh_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE ai_analysis_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_cost_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_token_balance ENABLE ROW LEVEL SECURITY;

-- Policies for ai_analysis_jobs
CREATE POLICY "Users can view own analysis jobs"
  ON ai_analysis_jobs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all analysis jobs"
  ON ai_analysis_jobs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policies for user_subscriptions
CREATE POLICY "Users can view own subscriptions"
  ON user_subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all subscriptions"
  ON user_subscriptions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policies for ai_cost_analytics
CREATE POLICY "Users can view own cost analytics"
  ON ai_cost_analytics FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all cost analytics"
  ON ai_cost_analytics FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policies for user_token_balance
CREATE POLICY "Users can view own token balance"
  ON user_token_balance FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all token balances"
  ON user_token_balance FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS ai_analysis_jobs_user_id_idx ON ai_analysis_jobs(user_id);
CREATE INDEX IF NOT EXISTS ai_analysis_jobs_input_hash_idx ON ai_analysis_jobs(input_hash);
CREATE INDEX IF NOT EXISTS ai_analysis_jobs_status_idx ON ai_analysis_jobs(status);
CREATE INDEX IF NOT EXISTS ai_analysis_jobs_created_at_idx ON ai_analysis_jobs(created_at DESC);

CREATE INDEX IF NOT EXISTS user_subscriptions_user_id_idx ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS user_subscriptions_stripe_subscription_id_idx ON user_subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS user_subscriptions_stripe_customer_id_idx ON user_subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS user_subscriptions_status_idx ON user_subscriptions(status);

CREATE INDEX IF NOT EXISTS ai_cost_analytics_user_id_idx ON ai_cost_analytics(user_id);
CREATE INDEX IF NOT EXISTS ai_cost_analytics_created_at_idx ON ai_cost_analytics(created_at DESC);
CREATE INDEX IF NOT EXISTS ai_cost_analytics_edge_function_name_idx ON ai_cost_analytics(edge_function_name);
CREATE INDEX IF NOT EXISTS ai_cost_analytics_operation_type_idx ON ai_cost_analytics(operation_type);

-- Create updated_at trigger functions
CREATE OR REPLACE FUNCTION update_ai_analysis_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_user_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_user_token_balance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS ai_analysis_jobs_updated_at_trigger ON ai_analysis_jobs;
CREATE TRIGGER ai_analysis_jobs_updated_at_trigger
  BEFORE UPDATE ON ai_analysis_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_analysis_jobs_updated_at();

DROP TRIGGER IF EXISTS user_subscriptions_updated_at_trigger ON user_subscriptions;
CREATE TRIGGER user_subscriptions_updated_at_trigger
  BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_user_subscriptions_updated_at();

DROP TRIGGER IF EXISTS user_token_balance_updated_at_trigger ON user_token_balance;
CREATE TRIGGER user_token_balance_updated_at_trigger
  BEFORE UPDATE ON user_token_balance
  FOR EACH ROW
  EXECUTE FUNCTION update_user_token_balance_updated_at();
