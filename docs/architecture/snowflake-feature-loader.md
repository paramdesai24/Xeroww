# Snowflake feature batch loader

The Snowflake path is optional and runs only through an explicit bounded command. Normal API, Kafka, and Spark startup do not connect to Snowflake or require Snowflake credentials.

## Configuration

Set `SNOWFLAKE_ENABLED=true`, account, user, warehouse, database, schema, and role. Configure exactly one authentication method: `SNOWFLAKE_PASSWORD` or `SNOWFLAKE_PRIVATE_KEY_PATH`. An encrypted private key may also use `SNOWFLAKE_PRIVATE_KEY_PASSPHRASE`.

## Invocation

```powershell
python -m api.warehouse.load_features `
  --output-root /opt/spark/output/features `
  --feature-batch-id 116 `
  --load-id explicit-attempt-id
```

The command validates only the requested completed batch, stages typed records in a session-scoped temporary table, merges new `record_key` values, persists accounting, and completes the ledger entry. It does not watch for new batches.

## Transactions and idempotency

The temporary table is created before transactional DML. Ledger start, staging, fact merge, accounting, and completion then share one transaction. A pre-commit failure rolls that transaction back and records a separate `FAILED` ledger row. Existing `record_key` values are duplicates; a different record key for the same logical window remains a valid revision.

A connection loss during commit can leave the client uncertain whether Snowflake committed. Recovery must inspect the explicit `load_id` before retrying; the loader never silently overwrites an existing load ID.

## Integration test

Ordinary tests are offline. The opt-in integration test runs only when
`XEROWW_SNOWFLAKE_INTEGRATION=1` and valid Snowflake configuration are already
available in the process environment. It applies the repository DDL before
verification, so no separate SQL step is required.

The real verification covers initial insertion, idempotent reload, a distinct
revision of the same logical window, deterministic latest-view selection,
load-ID collision rejection, a real failed transaction, and recovery with a
new load ID. Test records and ledger entries are removed after verification.
Missing credentials are an external prerequisite and must not be treated as a
passing integration result.
