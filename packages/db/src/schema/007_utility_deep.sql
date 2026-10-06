ALTER TABLE blinds ADD COLUMN facing_away BOOLEAN;

ALTER TABLE player_round_stats ADD COLUMN unused_utility_value INTEGER;
ALTER TABLE player_round_stats ADD COLUMN unused_utility_count INTEGER;
