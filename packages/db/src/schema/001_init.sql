CREATE TABLE IF NOT EXISTS schema_migrations (
  version     INTEGER PRIMARY KEY,
  applied_at  TIMESTAMP NOT NULL,
  checksum    VARCHAR   NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
  key         VARCHAR PRIMARY KEY,
  value_json  VARCHAR NOT NULL
);

CREATE TABLE IF NOT EXISTS players_of_interest (
  steam_id      VARCHAR PRIMARY KEY,
  display_name  VARCHAR NOT NULL,
  note          VARCHAR,
  colour        VARCHAR,
  added_at      TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS ingest_jobs (
  job_id       VARCHAR PRIMARY KEY,
  demo_path    VARCHAR NOT NULL,
  file_name    VARCHAR NOT NULL,
  sha256       VARCHAR,
  state        VARCHAR NOT NULL,
  stage        VARCHAR,
  progress     DOUBLE  NOT NULL DEFAULT 0,
  message      VARCHAR,
  error        VARCHAR,
  match_id     VARCHAR,
  pid          INTEGER,
  started_at   TIMESTAMP,
  finished_at  TIMESTAMP
);

CREATE TABLE IF NOT EXISTS matches (
  match_id           VARCHAR PRIMARY KEY,
  demo_sha256        VARCHAR NOT NULL UNIQUE,
  file_name          VARCHAR NOT NULL,
  file_path          VARCHAR,
  file_size_bytes    BIGINT,

  source             VARCHAR,
  source_confidence  VARCHAR,
  server_name        VARCHAR,
  client_name        VARCHAR,

  map_name           VARCHAR NOT NULL,
  map_raw            VARCHAR,
  has_radar          BOOLEAN NOT NULL,

  tick_rate          DOUBLE  NOT NULL,
  tick_rate_source   VARCHAR NOT NULL,
  last_tick          BIGINT,
  duration_seconds   DOUBLE,

  is_pov             BOOLEAN NOT NULL DEFAULT FALSE,
  has_voice          BOOLEAN NOT NULL DEFAULT FALSE,

  match_start_tick   BIGINT,
  restart_count      INTEGER NOT NULL DEFAULT 0,
  knife_round_tick   BIGINT,

  team_a_name        VARCHAR,
  team_b_name        VARCHAR,
  score_a            INTEGER,
  score_b            INTEGER,
  rounds_played      INTEGER,
  overtime           BOOLEAN NOT NULL DEFAULT FALSE,

  played_at          TIMESTAMP,
  ingested_at        TIMESTAMP NOT NULL,

  parser_version     VARCHAR,
  app_version        VARCHAR,
  schema_version     INTEGER NOT NULL,
  ingest_duration_ms INTEGER,
  ingest_peak_rss_mb INTEGER,

  bulk_state         VARCHAR NOT NULL DEFAULT 'full',
  pinned             BOOLEAN NOT NULL DEFAULT FALSE,

  validation_json    VARCHAR
);

CREATE TABLE IF NOT EXISTS players (
  steam_id         VARCHAR PRIMARY KEY,
  last_known_name  VARCHAR NOT NULL,
  first_seen       TIMESTAMP,
  last_seen        TIMESTAMP,
  matches_count    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS player_match (
  match_id        VARCHAR NOT NULL,
  steam_id        VARCHAR NOT NULL,
  name            VARCHAR NOT NULL,
  user_id         INTEGER,
  team_name       VARCHAR,
  starting_side   VARCHAR,
  is_user         BOOLEAN NOT NULL DEFAULT FALSE,
  is_poi          BOOLEAN NOT NULL DEFAULT FALSE,

  rounds_played   INTEGER NOT NULL DEFAULT 0,
  kills           INTEGER NOT NULL DEFAULT 0,
  deaths          INTEGER NOT NULL DEFAULT 0,
  assists         INTEGER NOT NULL DEFAULT 0,
  headshots       INTEGER NOT NULL DEFAULT 0,
  damage_total    INTEGER NOT NULL DEFAULT 0,
  adr             DOUBLE,
  kast_rounds     INTEGER NOT NULL DEFAULT 0,
  kast_pct        DOUBLE,

  opening_kills   INTEGER NOT NULL DEFAULT 0,
  opening_deaths  INTEGER NOT NULL DEFAULT 0,
  trade_kills     INTEGER NOT NULL DEFAULT 0,
  traded_deaths   INTEGER NOT NULL DEFAULT 0,
  clutches_won    INTEGER NOT NULL DEFAULT 0,
  clutches_tried  INTEGER NOT NULL DEFAULT 0,
  mvps            INTEGER NOT NULL DEFAULT 0,

  utility_damage    INTEGER NOT NULL DEFAULT 0,
  enemies_flashed   INTEGER NOT NULL DEFAULT 0,
  teammates_flashed INTEGER NOT NULL DEFAULT 0,

  PRIMARY KEY (match_id, steam_id)
);

CREATE TABLE IF NOT EXISTS rounds (
  match_id           VARCHAR NOT NULL,

  round_num          INTEGER NOT NULL,
  game_round_num     INTEGER,

  phase              VARCHAR NOT NULL,

  start_tick         BIGINT,
  freeze_end_tick    BIGINT,
  end_tick           BIGINT,
  official_end_tick  BIGINT,

  bomb_plant_tick    BIGINT,
  plant_site         VARCHAR,
  bomb_defuse_tick   BIGINT,
  bomb_explode_tick  BIGINT,

  winner_side        VARCHAR,
  win_reason         VARCHAR,

  ct_score_after     INTEGER,
  t_score_after      INTEGER,

  ct_equip_value     INTEGER,
  t_equip_value      INTEGER,
  ct_buy_type        VARCHAR,
  t_buy_type         VARCHAR,

  is_overtime        BOOLEAN NOT NULL DEFAULT FALSE,
  half               INTEGER,

  PRIMARY KEY (match_id, round_num)
);

CREATE TABLE IF NOT EXISTS kills (
  kill_id              BIGINT PRIMARY KEY,
  match_id             VARCHAR NOT NULL,
  round_num            INTEGER,
  tick                 BIGINT NOT NULL,

  attacker_steam_id    VARCHAR,
  victim_steam_id      VARCHAR,
  assister_steam_id    VARCHAR,
  attacker_side        VARCHAR,
  victim_side          VARCHAR,

  weapon               VARCHAR,
  headshot             BOOLEAN,
  penetrated           INTEGER,
  noscope              BOOLEAN,
  attacker_blind       BOOLEAN,
  thru_smoke           BOOLEAN,
  attacker_in_air      BOOLEAN,
  distance             DOUBLE,

  attacker_x DOUBLE, attacker_y DOUBLE, attacker_z DOUBLE,
  victim_x   DOUBLE, victim_y   DOUBLE, victim_z   DOUBLE,

  is_first_kill_of_round BOOLEAN,
  is_entry               BOOLEAN,
  is_trade_kill          BOOLEAN,
  traded_kill_id         BIGINT,
  death_was_traded       BOOLEAN,
  traded_by_kill_id      BIGINT
);

CREATE TABLE IF NOT EXISTS damages (
  damage_id         BIGINT PRIMARY KEY,
  match_id          VARCHAR NOT NULL,
  round_num         INTEGER,
  tick              BIGINT NOT NULL,
  attacker_steam_id VARCHAR,
  victim_steam_id   VARCHAR,
  weapon            VARCHAR,
  dmg_health        INTEGER,
  dmg_armor         INTEGER,
  hitgroup          INTEGER,
  health_after      INTEGER,
  armor_after       INTEGER,
  is_utility        BOOLEAN,
  is_team_damage    BOOLEAN
);

CREATE TABLE IF NOT EXISTS weapon_fires (
  fire_id       BIGINT PRIMARY KEY,
  match_id      VARCHAR NOT NULL,
  round_num     INTEGER,
  tick          BIGINT NOT NULL,
  steam_id      VARCHAR,
  weapon        VARCHAR,

  x DOUBLE, y DOUBLE, z DOUBLE,
  pitch DOUBLE, yaw DOUBLE,
  punch_pitch DOUBLE, punch_yaw DOUBLE,
  is_scoped BOOLEAN,
  speed DOUBLE
);

CREATE TABLE IF NOT EXISTS blinds (
  blind_id          BIGINT PRIMARY KEY,
  match_id          VARCHAR NOT NULL,
  round_num         INTEGER,
  tick              BIGINT NOT NULL,
  victim_steam_id   VARCHAR,
  thrower_steam_id  VARCHAR,
  blind_duration    DOUBLE,
  is_team_flash     BOOLEAN,

  victim_died_while_blind BOOLEAN,
  effective               BOOLEAN,
  effectiveness_model     VARCHAR
);

CREATE TABLE IF NOT EXISTS bomb_events (
  bomb_event_id BIGINT PRIMARY KEY,
  match_id      VARCHAR NOT NULL,
  round_num     INTEGER,
  tick          BIGINT NOT NULL,
  event_type    VARCHAR NOT NULL,
  steam_id      VARCHAR,
  site          VARCHAR,
  x DOUBLE, y DOUBLE, z DOUBLE
);

CREATE TABLE IF NOT EXISTS grenades (
  grenade_id        BIGINT PRIMARY KEY,
  match_id          VARCHAR NOT NULL,
  round_num         INTEGER,
  entity_id         INTEGER,
  thrower_steam_id  VARCHAR,
  grenade_type      VARCHAR,
  throw_tick        BIGINT,
  detonate_tick     BIGINT,
  expire_tick       BIGINT,
  throw_x DOUBLE, throw_y DOUBLE, throw_z DOUBLE,
  detonate_x DOUBLE, detonate_y DOUBLE, detonate_z DOUBLE,
  flight_time DOUBLE
);

CREATE TABLE IF NOT EXISTS grenade_detonations (
  det_id           BIGINT PRIMARY KEY,
  match_id         VARCHAR NOT NULL,
  round_num        INTEGER,
  tick             BIGINT NOT NULL,
  grenade_type     VARCHAR,
  thrower_steam_id VARCHAR,
  x DOUBLE, y DOUBLE, z DOUBLE,
  expire_tick      BIGINT,

  approx_radius    DOUBLE,
  approx_model     VARCHAR,
  is_approximation BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS chat_messages (
  chat_id      BIGINT PRIMARY KEY,
  match_id     VARCHAR NOT NULL,
  tick         BIGINT NOT NULL,
  steam_id     VARCHAR,
  name         VARCHAR,
  text         VARCHAR,
  is_team_only BOOLEAN
);

CREATE TABLE IF NOT EXISTS voice_segments (
  match_id      VARCHAR NOT NULL,
  steam_id      VARCHAR NOT NULL,
  segment_index INTEGER NOT NULL,
  start_tick    BIGINT,
  end_tick      BIGINT,
  duration_ms   INTEGER,
  sample_rate   INTEGER,
  rel_path      VARCHAR,
  alignment     VARCHAR,
  PRIMARY KEY (match_id, steam_id, segment_index)
);

CREATE TABLE IF NOT EXISTS player_round_stats (
  match_id   VARCHAR NOT NULL,
  round_num  INTEGER NOT NULL,
  steam_id   VARCHAR NOT NULL,
  side       VARCHAR,
  kills      INTEGER NOT NULL DEFAULT 0,
  deaths     INTEGER NOT NULL DEFAULT 0,
  assists    INTEGER NOT NULL DEFAULT 0,
  damage     INTEGER NOT NULL DEFAULT 0,
  utility_damage INTEGER NOT NULL DEFAULT 0,
  enemies_flashed INTEGER NOT NULL DEFAULT 0,
  survived   BOOLEAN,
  traded     BOOLEAN,
  opening_kill  BOOLEAN,
  opening_death BOOLEAN,
  clutch_type   VARCHAR,
  clutch_won    BOOLEAN,
  equip_value   INTEGER,
  buy_type      VARCHAR,
  kast          BOOLEAN,
  first_shot_ms DOUBLE,
  mean_preaim_pitch_deg DOUBLE,
  mean_preaim_total_deg DOUBLE,
  PRIMARY KEY (match_id, round_num, steam_id)
);

CREATE TABLE IF NOT EXISTS heatmap_bins (
  match_id   VARCHAR NOT NULL,
  steam_id   VARCHAR,
  map_name   VARCHAR NOT NULL,
  side       VARCHAR,
  phase      VARCHAR,
  kind       VARCHAR NOT NULL,
  bin_x      SMALLINT NOT NULL,
  bin_y      SMALLINT NOT NULL,
  bin_split  SMALLINT NOT NULL,
  count      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS engagements (
  eng_id            BIGINT PRIMARY KEY,
  match_id          VARCHAR NOT NULL,
  round_num         INTEGER,
  player_steam_id   VARCHAR,
  enemy_steam_id    VARCHAR,
  tick_start        BIGINT,
  tick_first_shot   BIGINT,
  tick_resolved     BIGINT,

  acquisition_model VARCHAR,
  ttfs_ms           DOUBLE,

  preaim_total_deg  DOUBLE,
  preaim_pitch_deg  DOUBLE,
  firstshot_total_deg DOUBLE,
  distance          DOUBLE,
  weapon            VARCHAR,
  outcome           VARCHAR,
  player_was_moving BOOLEAN,
  player_was_blind  BOOLEAN
);

CREATE TABLE IF NOT EXISTS economy (
  match_id   VARCHAR NOT NULL,
  round_num  INTEGER NOT NULL,
  steam_id   VARCHAR NOT NULL,
  side       VARCHAR,
  start_balance INTEGER,
  spent         INTEGER,
  earned        INTEGER,
  money_saved   INTEGER,
  equip_value   INTEGER,
  has_armor     BOOLEAN,
  has_helmet    BOOLEAN,
  has_defuser   BOOLEAN,
  primary_weapon VARCHAR,
  buy_type       VARCHAR,
  team_buy_type  VARCHAR,
  PRIMARY KEY (match_id, round_num, steam_id)
);

CREATE TABLE IF NOT EXISTS match_findings (
  finding_id     VARCHAR PRIMARY KEY,
  match_id       VARCHAR NOT NULL,
  steam_id       VARCHAR,
  metric_id      VARCHAR NOT NULL,
  value          DOUBLE,
  unit           VARCHAR,
  severity       VARCHAR,
  rank           INTEGER,
  confidence     VARCHAR,

  baseline_kind  VARCHAR NOT NULL,
  baseline_json  VARCHAR NOT NULL,

  title_key      VARCHAR NOT NULL,
  body_key       VARCHAR NOT NULL,
  params_json    VARCHAR,
  evidence_json  VARCHAR,
  approximation_json VARCHAR,
  computed_at    TIMESTAMP NOT NULL,
  rules_version  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS player_metric_history (
  steam_id   VARCHAR NOT NULL,
  match_id   VARCHAR NOT NULL,
  metric_id  VARCHAR NOT NULL,
  value      DOUBLE,
  sample_n   INTEGER,
  played_at  TIMESTAMP,
  PRIMARY KEY (steam_id, match_id, metric_id)
);
