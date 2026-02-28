-- Migration: update insert_webhook_event_and_order RPC to use ml_seller_id column

CREATE OR REPLACE FUNCTION insert_webhook_event_and_order(
  p_idempotency_key text,
  p_event_type text,
  p_payload jsonb,
  p_ml_seller_id text,
  p_ml_order_id text
)
RETURNS TABLE(order_id uuid, already_exists boolean)
LANGUAGE plpgsql
AS $$
DECLARE
  v_seller_id uuid;
  v_existing_order uuid;
BEGIN
  -- Lookup using dedicated column now
  SELECT id
  INTO v_seller_id
  FROM sellers
  WHERE ml_seller_id = p_ml_seller_id
  LIMIT 1;

  IF v_seller_id IS NULL THEN
    RAISE EXCEPTION 'Seller not found for Mercado Livre seller id %', p_ml_seller_id;
  END IF;

  BEGIN
    INSERT INTO webhook_events (idempotency_key, event_type, payload)
    VALUES (p_idempotency_key, p_event_type, p_payload);
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_existing_order FROM orders
      WHERE seller_id = v_seller_id AND ml_order_id = p_ml_order_id
      LIMIT 1;

    IF v_existing_order IS NOT NULL THEN
      order_id := v_existing_order;
      already_exists := true;
      RETURN NEXT;
      RETURN;
    ELSE
      order_id := NULL;
      already_exists := false;
      RETURN NEXT;
      RETURN;
    END IF;
  END;

  INSERT INTO orders (seller_id, ml_order_id, raw_payload, status, normalized_payload, processing_attempts)
  VALUES (v_seller_id, p_ml_order_id, p_payload, 'received', NULL, 0)
  RETURNING id INTO order_id;

  already_exists := false;
  RETURN NEXT;
END;
$$;
