-- Migration: RPC to atomically reserve next invoice number

CREATE OR REPLACE FUNCTION reserve_next_invoice_number(p_seller_id uuid)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_next_number integer;
BEGIN
  -- Lock the seller row and get current next_invoice_number
  SELECT next_invoice_number
  INTO v_next_number
  FROM sellers
  WHERE id = p_seller_id
  FOR UPDATE; -- Exclusive lock on this row

  IF v_next_number IS NULL THEN
    RAISE EXCEPTION 'Seller not found: %', p_seller_id;
  END IF;

  -- Increment and update
  UPDATE sellers
  SET next_invoice_number = next_invoice_number + 1,
      updated_at = now()
  WHERE id = p_seller_id;

  -- Return the number that was just reserved
  RETURN v_next_number;
END;
$$;

-- Also add updated_at column to sellers if not exists
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Create trigger to auto-update updated_at on sellers
CREATE OR REPLACE FUNCTION trigger_set_sellers_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_sellers_timestamp ON sellers;
CREATE TRIGGER set_sellers_timestamp
BEFORE UPDATE ON sellers
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_sellers_timestamp();

-- Add index on sellers for faster queries
CREATE INDEX IF NOT EXISTS idx_sellers_id ON sellers(id);
