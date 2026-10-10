UPDATE matches SET metrics_version = 0
 WHERE EXISTS (
   SELECT 1 FROM economy e
    WHERE e.match_id = matches.match_id AND e.side IS NULL
 );

DELETE FROM player_round_stats WHERE side IS NULL;

DELETE FROM economy WHERE side IS NULL;
