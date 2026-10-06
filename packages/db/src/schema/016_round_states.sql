CREATE TABLE IF NOT EXISTS round_states (
  match_id   VARCHAR NOT NULL,
  round_num  INTEGER NOT NULL,
  seq        INTEGER NOT NULL,
  alive_ct   INTEGER NOT NULL,
  alive_t    INTEGER NOT NULL,
  planted    BOOLEAN NOT NULL,

  ct_won     BOOLEAN,
  PRIMARY KEY (match_id, round_num, seq)
);
