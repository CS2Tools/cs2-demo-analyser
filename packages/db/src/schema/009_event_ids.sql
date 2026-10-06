CREATE TABLE kills__new (kill_id BIGINT, match_id VARCHAR, round_num INTEGER, tick BIGINT, attacker_steam_id VARCHAR, victim_steam_id VARCHAR, assister_steam_id VARCHAR, attacker_side VARCHAR, victim_side VARCHAR, weapon VARCHAR, headshot BOOLEAN, penetrated INTEGER, noscope BOOLEAN, attacker_blind BOOLEAN, thru_smoke BOOLEAN, attacker_in_air BOOLEAN, distance DOUBLE, attacker_x DOUBLE, attacker_y DOUBLE, attacker_z DOUBLE, victim_x DOUBLE, victim_y DOUBLE, victim_z DOUBLE, is_first_kill_of_round BOOLEAN, is_entry BOOLEAN, is_trade_kill BOOLEAN, traded_kill_id BIGINT, death_was_traded BOOLEAN, traded_by_kill_id BIGINT, assisted_flash BOOLEAN, PRIMARY KEY (match_id, kill_id));
INSERT INTO kills__new SELECT * FROM kills;
DROP TABLE kills;
ALTER TABLE kills__new RENAME TO kills;

CREATE TABLE damages__new (damage_id BIGINT, match_id VARCHAR, round_num INTEGER, tick BIGINT, attacker_steam_id VARCHAR, victim_steam_id VARCHAR, weapon VARCHAR, dmg_health INTEGER, dmg_armor INTEGER, hitgroup INTEGER, health_after INTEGER, armor_after INTEGER, is_utility BOOLEAN, is_team_damage BOOLEAN, PRIMARY KEY (match_id, damage_id));
INSERT INTO damages__new SELECT * FROM damages;
DROP TABLE damages;
ALTER TABLE damages__new RENAME TO damages;

CREATE TABLE weapon_fires__new (fire_id BIGINT, match_id VARCHAR, round_num INTEGER, tick BIGINT, steam_id VARCHAR, weapon VARCHAR, x DOUBLE, y DOUBLE, z DOUBLE, pitch DOUBLE, yaw DOUBLE, punch_pitch DOUBLE, punch_yaw DOUBLE, is_scoped BOOLEAN, speed DOUBLE, PRIMARY KEY (match_id, fire_id));
INSERT INTO weapon_fires__new SELECT * FROM weapon_fires;
DROP TABLE weapon_fires;
ALTER TABLE weapon_fires__new RENAME TO weapon_fires;

CREATE TABLE blinds__new (blind_id BIGINT, match_id VARCHAR, round_num INTEGER, tick BIGINT, victim_steam_id VARCHAR, thrower_steam_id VARCHAR, blind_duration DOUBLE, is_team_flash BOOLEAN, victim_died_while_blind BOOLEAN, effective BOOLEAN, effectiveness_model VARCHAR, facing_away BOOLEAN, flash_distance DOUBLE, PRIMARY KEY (match_id, blind_id));
INSERT INTO blinds__new SELECT * FROM blinds;
DROP TABLE blinds;
ALTER TABLE blinds__new RENAME TO blinds;

CREATE TABLE bomb_events__new (bomb_event_id BIGINT, match_id VARCHAR, round_num INTEGER, tick BIGINT, event_type VARCHAR, steam_id VARCHAR, site VARCHAR, x DOUBLE, y DOUBLE, z DOUBLE, place VARCHAR, has_kit BOOLEAN, PRIMARY KEY (match_id, bomb_event_id));
INSERT INTO bomb_events__new SELECT * FROM bomb_events;
DROP TABLE bomb_events;
ALTER TABLE bomb_events__new RENAME TO bomb_events;

CREATE TABLE grenades__new (grenade_id BIGINT, match_id VARCHAR, round_num INTEGER, entity_id INTEGER, thrower_steam_id VARCHAR, grenade_type VARCHAR, throw_tick BIGINT, detonate_tick BIGINT, expire_tick BIGINT, throw_x DOUBLE, throw_y DOUBLE, throw_z DOUBLE, detonate_x DOUBLE, detonate_y DOUBLE, detonate_z DOUBLE, flight_time DOUBLE, PRIMARY KEY (match_id, grenade_id));
INSERT INTO grenades__new SELECT * FROM grenades;
DROP TABLE grenades;
ALTER TABLE grenades__new RENAME TO grenades;

CREATE TABLE grenade_detonations__new (det_id BIGINT, match_id VARCHAR, round_num INTEGER, tick BIGINT, grenade_type VARCHAR, thrower_steam_id VARCHAR, x DOUBLE, y DOUBLE, z DOUBLE, expire_tick BIGINT, approx_radius DOUBLE, approx_model VARCHAR, is_approximation BOOLEAN, PRIMARY KEY (match_id, det_id));
INSERT INTO grenade_detonations__new SELECT * FROM grenade_detonations;
DROP TABLE grenade_detonations;
ALTER TABLE grenade_detonations__new RENAME TO grenade_detonations;

CREATE TABLE chat_messages__new (chat_id BIGINT, match_id VARCHAR, tick BIGINT, steam_id VARCHAR, name VARCHAR, text VARCHAR, is_team_only BOOLEAN, PRIMARY KEY (match_id, chat_id));
INSERT INTO chat_messages__new SELECT * FROM chat_messages;
DROP TABLE chat_messages;
ALTER TABLE chat_messages__new RENAME TO chat_messages;

CREATE TABLE engagements__new (eng_id BIGINT, match_id VARCHAR, round_num INTEGER, player_steam_id VARCHAR, enemy_steam_id VARCHAR, tick_start BIGINT, tick_first_shot BIGINT, tick_resolved BIGINT, acquisition_model VARCHAR, ttfs_ms DOUBLE, preaim_total_deg DOUBLE, preaim_pitch_deg DOUBLE, firstshot_total_deg DOUBLE, distance DOUBLE, weapon VARCHAR, outcome VARCHAR, player_was_moving BOOLEAN, player_was_blind BOOLEAN, PRIMARY KEY (match_id, eng_id));
INSERT INTO engagements__new SELECT * FROM engagements;
DROP TABLE engagements;
ALTER TABLE engagements__new RENAME TO engagements;
