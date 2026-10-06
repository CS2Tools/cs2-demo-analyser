import { DuckDb } from '../packages/db/dist/duckdb.js';
import { join } from 'node:path';

const DB = join(process.cwd(), 'data', 'library.duckdb');

const db = await DuckDb.open(DB);
const q = async (sql, params = []) => db.query(sql, params);
const line = (s = '') => process.stdout.write(`${s}\n`);
const pct = (a, b) => (b === 0 ? '—' : `${((100 * a) / b).toFixed(1)}%`);

line();
line('='.repeat(78));
line('  MEDICAO F4.3 — o que da para dizer sobre precisao');
line('='.repeat(78));

line();
line('1. O dano cai no mesmo tick do disparo?');
const [tot] = await q(`SELECT COUNT(*)::INTEGER n FROM damages WHERE NOT is_utility`);
const [exact] = await q(
  `SELECT COUNT(*)::INTEGER n
     FROM damages d
    WHERE NOT d.is_utility
      AND EXISTS (SELECT 1 FROM weapon_fires f
                   WHERE f.match_id = d.match_id AND f.steam_id = d.attacker_steam_id
                     AND f.tick = d.tick)`,
);
const [near] = await q(
  `SELECT COUNT(*)::INTEGER n
     FROM damages d
    WHERE NOT d.is_utility
      AND EXISTS (SELECT 1 FROM weapon_fires f
                   WHERE f.match_id = d.match_id AND f.steam_id = d.attacker_steam_id
                     AND ABS(f.tick - d.tick) <= 1)`,
);
line(`   dano de arma: ${tot.n}`);
line(`   com disparo no MESMO tick:  ${exact.n}  (${pct(exact.n, tot.n)})`);
line(`   com disparo a +-1 tick:     ${near.n}  (${pct(near.n, tot.n)})`);

line();
line('2. O nome da arma bate entre as tabelas? (no mesmo tick)');
const names = await q(
  `SELECT f.weapon AS tiro, d.weapon AS dano, COUNT(*)::INTEGER n
     FROM weapon_fires f
     JOIN damages d ON d.match_id = f.match_id AND d.tick = f.tick
                   AND d.attacker_steam_id = f.steam_id AND NOT d.is_utility
    GROUP BY 1, 2
    ORDER BY n DESC
    LIMIT 25`,
);
for (const r of names) {
  const flag = r.tiro === r.dano ? '   ' : ' ! ';
  line(`  ${flag}${String(r.tiro).padEnd(18)} -> ${String(r.dano).padEnd(18)} ${r.n}`);
}

line();
line('3. Um disparo, quantas linhas de dano? (pelotas de escopeta)');
const pellets = await q(
  `WITH hits AS (
     SELECT f.match_id, f.fire_id, f.weapon,
            COUNT(d.damage_id)::INTEGER n,
            COUNT(DISTINCT d.victim_steam_id)::INTEGER vitimas
       FROM weapon_fires f
       LEFT JOIN damages d ON d.match_id = f.match_id AND d.tick = f.tick
                          AND d.attacker_steam_id = f.steam_id AND NOT d.is_utility
      GROUP BY 1, 2, 3
   )
   SELECT weapon, MAX(n)::INTEGER max_linhas, MAX(vitimas)::INTEGER max_vitimas,
          ROUND(AVG(n), 2) media_linhas, COUNT(*)::INTEGER disparos
     FROM hits
    GROUP BY weapon
   HAVING MAX(n) > 1
    ORDER BY max_linhas DESC
    LIMIT 15`,
);
for (const r of pellets) {
  line(
    `   ${String(r.weapon).padEnd(16)} disparos=${String(r.disparos).padEnd(6)} ` +
      `max linhas=${String(r.max_linhas).padEnd(4)} max vitimas=${String(r.max_vitimas).padEnd(4)} media=${r.media_linhas}`,
  );
}

line();
line('4. hitgroup: distribuicao e conferencia contra headshot');
const groups = await q(
  `SELECT hitgroup, COUNT(*)::INTEGER n, SUM(dmg_health)::INTEGER dano
     FROM damages WHERE NOT is_utility GROUP BY 1 ORDER BY 1`,
);
for (const g of groups) {
  line(`   grupo ${String(g.hitgroup).padEnd(5)} ${String(g.n).padEnd(7)} linhas  ${g.dano} de dano`);
}
const [hs] = await q(
  `SELECT
     SUM(CASE WHEN k.headshot AND d.hitgroup = 1 THEN 1 ELSE 0 END)::INTEGER concorda,
     SUM(CASE WHEN k.headshot AND d.hitgroup <> 1 THEN 1 ELSE 0 END)::INTEGER discorda,
     COUNT(*)::INTEGER pares
   FROM kills k
   JOIN damages d ON d.match_id = k.match_id AND d.tick = k.tick
                 AND d.attacker_steam_id = k.attacker_steam_id
                 AND d.victim_steam_id = k.victim_steam_id
  WHERE k.round_num IS NOT NULL AND NOT d.is_utility`,
);
line(`   kill de headshot com hitgroup=1: ${hs.concorda} | com outro grupo: ${hs.discorda} | pares: ${hs.pares}`);

line();
line('5. Velocidade no tiro');
const [speed] = await q(
  `SELECT COUNT(*)::INTEGER n, COUNT(speed)::INTEGER com_speed FROM weapon_fires`,
);
line(`   disparos: ${speed.n} | com velocidade gravada: ${speed.com_speed}`);
line('   (a F4.4 deriva a velocidade como o Pass U ja faz: posicao do tick anterior)');

const [fires] = await q(`SELECT COUNT(*)::INTEGER n FROM weapon_fires`);
const [withPos] = await q(`SELECT COUNT(*)::INTEGER n FROM weapon_fires WHERE x IS NOT NULL`);
line();
line('='.repeat(78));
line(`  disparos: ${fires.n} | com posicao/angulo do Pass D: ${withPos.n} (${pct(withPos.n, fires.n)})`);
line('='.repeat(78));
line();

await db.close();
