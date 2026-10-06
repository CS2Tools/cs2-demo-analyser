DELETE FROM engagements
 WHERE weapon IS NULL
    OR lower(weapon) IN (
         'inferno', 'molotov', 'incgrenade', 'hegrenade', 'flashbang',
         'smokegrenade', 'decoy', 'taser', 'world', 'planted_c4', 'c4'
       )
    OR lower(weapon) LIKE '%knife%'
    OR lower(weapon) LIKE '%bayonet%';

DELETE FROM engagements e
 USING kills k
 WHERE k.match_id = e.match_id
   AND k.tick = e.tick_resolved
   AND k.attacker_steam_id = e.player_steam_id
   AND k.victim_steam_id = e.enemy_steam_id
   AND k.attacker_side = k.victim_side;

DELETE FROM player_metric_history;
DELETE FROM match_findings;
