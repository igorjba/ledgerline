-- LedgerLine schema. The bitemporal invariant is enforced *here*, by the
-- database, not by application code — that is the whole point of the Postgres
-- path. btree_gist lets an exclusion constraint mix an equality column
-- (meter_id) with two range overlaps (valid + transaction time).

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS readings (
  id                text        PRIMARY KEY,
  meter_id          text        NOT NULL,
  idempotency_key   text        NOT NULL,
  -- valid_time: the consumption interval the reading asserts.
  valid_range       tstzrange   NOT NULL,
  -- transaction_time: [inserted, ∞) while believed; closed when superseded.
  transaction_range tstzrange   NOT NULL,
  kwh               numeric(14,4) NOT NULL,
  source            text        NOT NULL,

  -- The same idempotency key is the same fact, forever. This is what makes a
  -- duplicate delivery a no-op at the storage layer.
  CONSTRAINT readings_idempotency_key UNIQUE (idempotency_key),

  -- The bitemporal rule: for one meter, no two *open* assertions may overlap in
  -- valid time. Because a correction first closes the prior assertion's
  -- transaction_range and only then inserts the new open one, their transaction
  -- ranges no longer overlap and the insert is admitted; forget to close it and
  -- the database rejects the write. The invariant cannot be violated by a bug in
  -- the application — only by dropping this constraint.
  CONSTRAINT readings_no_overlapping_assertion EXCLUDE USING gist (
    meter_id          WITH =,
    valid_range       WITH &&,
    transaction_range WITH &&
  )
);

CREATE INDEX IF NOT EXISTS readings_meter_valid
  ON readings USING gist (meter_id, valid_range);

-- Transactional outbox. Rows are written in the same transaction as the fact
-- they describe, then drained by the relay (QStash) after the commit — so an
-- event can never be lost to a serverless function dying between commit and
-- publish.
CREATE TABLE IF NOT EXISTS outbox (
  id           text        PRIMARY KEY,
  type         text        NOT NULL,
  payload      jsonb       NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

CREATE INDEX IF NOT EXISTS outbox_unpublished
  ON outbox (created_at)
  WHERE published_at IS NULL;

-- Idempotent ingestion, atomic and in the right order. This is a function rather
-- than a data-modifying CTE on purpose: in a CTE the INSERT would not see the
-- close-UPDATE (they share one snapshot), so the exclusion constraint would fire
-- a false conflict against the assertion being closed. In plpgsql the UPDATE
-- commits its index change before the INSERT is checked, so the only thing that
-- can reject the write is a genuine overlap.
CREATE OR REPLACE FUNCTION ingest_reading(
  p_id          text,
  p_meter       text,
  p_key         text,
  p_valid_start timestamptz,
  p_valid_end   timestamptz,
  p_now         timestamptz,
  p_kwh         numeric,
  p_source      text,
  p_event_id    text
) RETURNS TABLE (outcome text, reading_id text)
LANGUAGE plpgsql AS $$
DECLARE
  existing_id  text;
  closed_count int;
BEGIN
  SELECT id INTO existing_id FROM readings WHERE idempotency_key = p_key;
  IF existing_id IS NOT NULL THEN
    RETURN QUERY SELECT 'duplicate'::text, existing_id;
    RETURN;
  END IF;

  UPDATE readings
     SET transaction_range = tstzrange(lower(transaction_range), p_now, '[)')
   WHERE meter_id = p_meter
     AND upper_inf(transaction_range)
     AND valid_range && tstzrange(p_valid_start, p_valid_end, '[)');
  GET DIAGNOSTICS closed_count = ROW_COUNT;

  INSERT INTO readings (id, meter_id, idempotency_key, valid_range, transaction_range, kwh, source)
  VALUES (p_id, p_meter, p_key,
          tstzrange(p_valid_start, p_valid_end, '[)'),
          tstzrange(p_now, NULL, '[)'),
          p_kwh, p_source);

  INSERT INTO outbox (id, type, payload, created_at)
  VALUES (p_event_id, 'reading.ingested',
          jsonb_build_object('meterId', p_meter, 'idempotencyKey', p_key, 'kwh', p_kwh),
          p_now);

  RETURN QUERY SELECT CASE WHEN closed_count > 0 THEN 'corrected' ELSE 'accepted' END, p_id;
EXCEPTION
  -- Two concurrent deliveries of the same key can both pass the SELECT and race
  -- to INSERT; the loser hits the idempotency UNIQUE constraint. The EXCEPTION
  -- block rolls back this call's partial work and reports a clean duplicate, so
  -- concurrency yields the same no-op as a sequential re-delivery.
  WHEN unique_violation THEN
    SELECT id INTO existing_id FROM readings WHERE idempotency_key = p_key;
    RETURN QUERY SELECT 'duplicate'::text, existing_id;
END;
$$;
