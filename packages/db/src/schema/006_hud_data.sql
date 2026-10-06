ALTER TABLE rounds ADD COLUMN round_time_seconds INTEGER;
ALTER TABLE rounds ADD COLUMN freeze_time_seconds INTEGER;

ALTER TABLE matches ADD COLUMN c4_timer_seconds DOUBLE;
ALTER TABLE matches ADD COLUMN c4_timer_source VARCHAR;

ALTER TABLE bomb_events ADD COLUMN place VARCHAR;

ALTER TABLE bomb_events ADD COLUMN has_kit BOOLEAN;

ALTER TABLE kills ADD COLUMN assisted_flash BOOLEAN;
