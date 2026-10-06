ALTER TABLE matches ADD COLUMN stored_demo_path VARCHAR;

ALTER TABLE matches ADD COLUMN replay_data_version INTEGER DEFAULT 1;
