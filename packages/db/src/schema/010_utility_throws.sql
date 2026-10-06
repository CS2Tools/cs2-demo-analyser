CREATE TABLE IF NOT EXISTS utility_throws (
  match_id      VARCHAR NOT NULL,
  throw_id      BIGINT  NOT NULL,

  map_name      VARCHAR NOT NULL,
  round_num     INTEGER,
  steam_id      VARCHAR,
  side          VARCHAR,

  grenade_type  VARCHAR NOT NULL,

  throw_tick    BIGINT,
  detonate_tick BIGINT,
  flight_time   DOUBLE,

  throw_x DOUBLE, throw_y DOUBLE, throw_z DOUBLE,
  pitch   DOUBLE, yaw     DOUBLE,

  crouched      BOOLEAN,

  on_ground     BOOLEAN,

  speed         DOUBLE,

  throw_strength DOUBLE,

  det_x DOUBLE, det_y DOUBLE, det_z DOUBLE,

  enemies_blinded INTEGER,
  enemy_damage    INTEGER,
  kills_after     INTEGER,

  PRIMARY KEY (match_id, throw_id)
);

CREATE INDEX IF NOT EXISTS utility_throws_map ON utility_throws (map_name, grenade_type);

CREATE TABLE IF NOT EXISTS lineup_collection (
  lineup_id     VARCHAR PRIMARY KEY,
  name          VARCHAR NOT NULL,
  note          VARCHAR,
  map_name      VARCHAR NOT NULL,
  grenade_type  VARCHAR NOT NULL,
  side          VARCHAR,

  throw_x DOUBLE, throw_y DOUBLE, throw_z DOUBLE,
  pitch   DOUBLE, yaw     DOUBLE,
  crouched      BOOLEAN,
  on_ground     BOOLEAN,
  speed         DOUBLE,
  throw_strength DOUBLE,
  det_x DOUBLE, det_y DOUBLE, det_z DOUBLE,

  source_match_id VARCHAR,
  source_round    INTEGER,
  source_tick     BIGINT,

  created_at    TIMESTAMP NOT NULL
);
