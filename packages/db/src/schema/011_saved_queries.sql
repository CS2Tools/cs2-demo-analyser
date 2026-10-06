CREATE TABLE IF NOT EXISTS saved_queries (
  query_id   VARCHAR PRIMARY KEY,
  name       VARCHAR NOT NULL,
  subject    VARCHAR NOT NULL,
  spec_json  VARCHAR NOT NULL,
  created_at TIMESTAMP NOT NULL
);
