-- Migration: add ml_seller_id column for deterministic seller lookup

-- 1. Add column (nullable initially)
ALTER TABLE sellers
  ADD COLUMN IF NOT EXISTS ml_seller_id text;

-- 2. Populate using existing JSON credentials or random UUID so we maintain uniqueness
UPDATE sellers
SET ml_seller_id = COALESCE(
      NULLIF(mercadolivre_credentials->>'seller_id',''),
      NULLIF(mercadolivre_credentials->>'user_id',''),
      gen_random_uuid()::text
);

-- 3. Create unique index and enforce not-null constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_sellers_ml_seller_id ON sellers(ml_seller_id);

ALTER TABLE sellers
  ALTER COLUMN ml_seller_id SET NOT NULL;
