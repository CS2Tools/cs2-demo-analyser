ALTER TABLE player_match ADD COLUMN team_slot VARCHAR;

ALTER TABLE matches ADD COLUMN roster_version INTEGER DEFAULT 0;

ALTER TABLE matches ADD COLUMN replay_slot_count INTEGER;

ALTER TABLE rounds ADD COLUMN roster_ct INTEGER;
ALTER TABLE rounds ADD COLUMN roster_t INTEGER;

CREATE TABLE IF NOT EXISTS roster_spells (
  match_id    VARCHAR NOT NULL,
  steam_id    VARCHAR NOT NULL,
  spell_seq   INTEGER NOT NULL,
  team_slot   VARCHAR,
  first_round INTEGER NOT NULL,
  last_round  INTEGER NOT NULL,
  rounds      INTEGER NOT NULL,
  PRIMARY KEY (match_id, steam_id, spell_seq)
);

CREATE TABLE IF NOT EXISTS roster_handoffs (
  match_id       VARCHAR NOT NULL,
  handoff_seq    INTEGER NOT NULL,
  team_slot      VARCHAR NOT NULL,
  out_steam_id   VARCHAR,
  out_last_round INTEGER,
  in_steam_id    VARCHAR,
  in_first_round INTEGER,
  gap_rounds     INTEGER,
  inference      VARCHAR NOT NULL,
  PRIMARY KEY (match_id, handoff_seq)
);
