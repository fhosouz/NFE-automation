-- Supabase / Postgres initial schema for NFe Automation (Story 002)

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Sellers table
CREATE TABLE IF NOT EXISTS sellers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  mercadolivre_credentials jsonb,
  issuer_data jsonb,
  next_invoice_number integer NOT NULL DEFAULT 1,
  serie text NOT NULL DEFAULT '1',
  environment text NOT NULL DEFAULT '2', -- '2' = homologation
  settings jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  ml_order_id text NOT NULL,
  raw_payload jsonb,
  normalized_payload jsonb,
  status text NOT NULL DEFAULT 'received',
  processing_attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE orders
  ADD CONSTRAINT orders_seller_ml_order_unique UNIQUE (seller_id, ml_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  ml_sku text,
  ncm text,
  name text,
  price numeric(12,2),
  pending_configuration boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_products_seller_pending ON products(seller_id, pending_configuration);

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  ml_customer_id text,
  cpf_cnpj text,
  name text,
  address jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customers_seller_cpf ON customers(seller_id, cpf_cnpj);

-- XMLs table (generated NFe artifacts)
CREATE TABLE IF NOT EXISTS xmls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  nNF integer,
  serie text,
  access_key_44 text,
  xml_url text,
  xsd_version text,
  validation_status text,
  error_details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Uniqueness constraints to prevent duplicates
ALTER TABLE xmls
  ADD CONSTRAINT xmls_seller_access_key_unique UNIQUE (seller_id, access_key_44);
ALTER TABLE xmls
  ADD CONSTRAINT xmls_seller_serie_nnf_unique UNIQUE (seller_id, serie, nNF);

CREATE INDEX IF NOT EXISTS idx_xmls_seller ON xmls(seller_id);

-- Webhook events / idempotency table
CREATE TABLE IF NOT EXISTS webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text UNIQUE,
  event_type text,
  payload jsonb,
  received_at timestamptz NOT NULL DEFAULT now()
);

-- Helpful function: update updated_at on orders
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_orders_timestamp ON orders;
CREATE TRIGGER set_orders_timestamp
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- Reservation helper: optional reservation table
CREATE TABLE IF NOT EXISTS invoice_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  reserved_nnf integer NOT NULL,
  serie text,
  order_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoice_reservations_seller ON invoice_reservations(seller_id, reserved_nnf);

-- End of migration
