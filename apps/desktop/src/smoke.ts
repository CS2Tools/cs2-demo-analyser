import { existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ApiContext } from '@cs2/api';
import { invoke } from '@cs2/api';
import type { IngestProgress } from '@cs2/contract';

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

const out = (s = '') => process.stdout.write(`${s}\n`);

const INGEST_TIMEOUT_MS = 20 * 60_000;

export async function runSmokeTest(
  ctx: ApiContext,
  demoPath: string,
  onProgress: (cb: (msg: IngestProgress) => void) => void,
): Promise<number> {
  const checks: Check[] = [];
  const add = (name: string, ok: boolean, detail: string) => {
    checks.push({ name, ok, detail });
    out(`  [${ok ? ' ok ' : 'FALHA'}] ${name.padEnd(46)} ${detail}`);
  };

  out('');
  out('  ' + '='.repeat(76));
  out('  PORTAO — teste de fumaca do app EMPACOTADO (F1 a F6)');
  out('  ' + '='.repeat(76));
  out('');

  try {
    const tables = await ctx.db.listTables();
    add('DuckDB carrega e o schema esta aplicado', tables.includes('matches'), `${tables.length} tabelas`);
  } catch (err) {
    add('DuckDB carrega e o schema esta aplicado', false, String(err));
    return report(checks);
  }

  try {
    const health = await invoke('app.health', {}, ctx);
    add('rota app.health responde por IPC', health.transport === 'ipc', `transporte=${health.transport}`);
  } catch (err) {
    add('rota app.health responde por IPC', false, String(err));
  }

  try {
    const maps = await invoke('maps.list', {}, ctx);
    add('radares empacotados', maps.length === 10, `${maps.length} mapas`);
  } catch (err) {
    add('radares empacotados', false, String(err));
  }

  {
    const dir = resolve(process.resourcesPath, 'icons');
    const needed = ['equipment/ak47.svg', 'equipment/c4.svg', 'deathnotice/icon_headshot.svg', 'maps/map_icon_de_overpass.svg', 'LICENSE'];
    const missing = needed.filter((f) => !existsSync(resolve(dir, f)));
    add('icones empacotados', missing.length === 0, missing.length ? `faltam: ${missing.join(', ')}` : `${needed.length} conferidos`);
  }

  const started = Date.now();
  const finished = new Promise<IngestProgress>((resolve) => {
    onProgress((msg) => {
      if (msg.state === 'done' || msg.state === 'error' || msg.state === 'cancelled') {
        resolve(msg);
      }
    });
  });

  let ingestOk = false;
  try {
    await invoke('ingest.submit', { path: demoPath, force: true }, ctx);
    const result = await Promise.race([
      finished,
      new Promise<IngestProgress>((_, reject) =>
        setTimeout(
          () => reject(new Error(`estourou ${INGEST_TIMEOUT_MS / 60_000} minutos`)),
          INGEST_TIMEOUT_MS,
        ),
      ),
    ]);
    ingestOk = result.state === 'done';
    add(
      'worker empacotado ingere a demo',
      ingestOk,
      ingestOk
        ? `${((Date.now() - started) / 1000).toFixed(1)}s — ${result.message ?? ''}`
        : (result.error ?? result.state),
    );
  } catch (err) {
    add('worker empacotado ingere a demo', false, String(err));
  }

  if (ingestOk) {
    try {
      const matches = await invoke('matches.list', {}, ctx);
      const m = matches[0];
      add('partida aparece na biblioteca', matches.length > 0, m ? `${m.mapName} ${m.scoreA}x${m.scoreB}` : 'nenhuma');

      if (m) {
        const detail = await invoke('match.get', { matchId: m.matchId }, ctx);

        const semTime = detail.scoreboard.filter((p) => p.teamName === null);
        const porTime = new Map<string, Set<string>>();
        for (const p of detail.scoreboard) {
          if (p.teamName === null) continue;
          const set = porTime.get(p.teamName) ?? new Set<string>();
          set.add(p.steamId);
          porTime.set(p.teamName, set);
        }
        const elencos = [...porTime.values()];
        const ids = new Set(detail.scoreboard.map((p) => p.steamId));
        const disjuntos = elencos.length === 2
          && [...elencos[1]!].every((id) => !elencos[0]!.has(id));
        add(
          'scoreboard tem todos os jogadores, cada um com time',
          detail.scoreboard.length >= 10 &&
            ids.size === detail.scoreboard.length &&
            semTime.length === 0 &&
            elencos.length === 2 &&
            disjuntos &&
            elencos.every((e) => e.size >= 5),
          `${detail.scoreboard.length} jogadores em ${elencos.length} time(s)` +
            ` (${elencos.map((e) => e.size).join(' e ')})` +
            (semTime.length > 0 ? `; ${semTime.length} SEM TIME` : ''),
        );
        add(
          'placar fecha com os rounds live',
          (m.scoreA ?? 0) + (m.scoreB ?? 0) === detail.rounds.length,
          `${m.scoreA}+${m.scoreB} = ${detail.rounds.length} rounds`,
        );
        add(
          'round faca separado da partida',
          detail.discardedRounds.length > 0,
          `${detail.discardedRounds.length} descartado(s)`,
        );
        add(
          'checagens pos-ingestao passaram',
          detail.validation.every((v) => v.ok),
          detail.validation.filter((v) => !v.ok).map((v) => v.check).join('; ') || 'todas',
        );
      }
    } catch (err) {
      add('partida aparece na biblioteca', false, String(err));
    }
  }

  try {
    const r = await invoke('sql.query', { sql: 'SELECT COUNT(*) AS n FROM kills', maxRows: 10 }, ctx);
    const n = Number(r.rows[0]?.[0] ?? 0);
    add('console SQL consulta o banco', n > 0, `${n} kills`);
  } catch (err) {
    add('console SQL consulta o banco', false, String(err));
  }

  let matchId: string | null = null;
  try {
    matchId = (await invoke('matches.list', {}, ctx))[0]?.matchId ?? null;
    if (!matchId) throw new Error('nenhuma partida');
    const f = await invoke('match.findings', { matchId }, ctx);
    const semBase = f.all.filter((v) => !v.baseline);
    add(
      'veredictos com procedencia',
      f.summary.length >= 3 && f.summary.length <= 5 && semBase.length === 0,
      `${f.summary.length} no resumo, ${f.all.length} no total`,
    );
  } catch (err) {
    add('veredictos com procedencia', false, String(err));
  }

  try {
    if (!matchId) throw new Error('nenhuma partida');
    const r = await invoke('export.match', { matchId }, ctx);
    add('exporta a partida em zip', r.bytes > 100_000, `${(r.bytes / 1024 / 1024).toFixed(1)} MB`);
    rmSync(r.path, { force: true });
  } catch (err) {
    add('exporta a partida em zip', false, String(err));
  }

  try {
    const r = await invoke(
      'sql.query',
      { sql: 'SELECT file_path, stored_demo_path FROM matches LIMIT 1', maxRows: 1 },
      ctx,
    );
    const [original, stored] = (r.rows[0] ?? []) as [string | null, string | null];
    const inLibrary =
      typeof stored === 'string' &&
      resolve(stored).startsWith(resolve(ctx.dataDir, 'demos')) &&
      existsSync(stored);
    add(
      'demo copiada para a biblioteca',
      inLibrary && resolve(stored!) !== resolve(original ?? ''),
      inLibrary ? `lida de ${stored!.slice(-24)}` : `stored_demo_path=${String(stored)}`,
    );
  } catch (err) {
    add('demo copiada para a biblioteca', false, String(err));
  }

  try {
    if (!matchId) throw new Error('nenhuma partida');
    const replay = await invoke('replay.round', { matchId, roundNum: 1 }, ctx);
    const h = replay.hud;
    const ok =
      h.dataVersion >= 2 &&
      h.roundTimeSeconds !== null &&
      h.money.length > 0 &&
      h.inventory.length > 0 &&
      h.weaponNames.length > 0;
    add(
      'HUD do replay com dinheiro e inventario',
      ok,
      `round ${h.roundTimeSeconds}s, C4 ${h.c4TimerSeconds}s (${h.c4TimerSource}), ` +
        `${h.money.length} mudancas de dinheiro`,
    );
  } catch (err) {
    add('HUD do replay com dinheiro e inventario', false, String(err));
  }

  {
    const dir = resolve(process.resourcesPath, 'voice-extractor');
    const needed = ['csgove.exe', 'opus.dll', 'tier0.dll', 'vaudio_celt.dll'];
    const missing = needed.filter((f) => !existsSync(resolve(dir, f)));
    add(
      'extrator de voz instalado com as DLLs',
      missing.length === 0,
      missing.length ? `faltam: ${missing.join(', ')}` : `${needed.length} arquivos`,
    );
  }
  try {
    const r = await invoke(
      'sql.query',
      {
        sql: `SELECT m.source, m.has_voice, COUNT(v.segment_index) AS trechos,
                     COUNT(DISTINCT v.steam_id) AS falantes,
                     SUM(CASE WHEN v.round_num IS NULL THEN 1 ELSE 0 END) AS sem_round
                FROM matches m LEFT JOIN voice_segments v USING (match_id)
               GROUP BY m.source, m.has_voice`,
        maxRows: 5,
      },
      ctx,
    );

    if (r.rows.length === 0) throw new Error('nenhuma partida');
    const [source, hasVoice, segs, talkers, semRound] = r.rows[0] ?? [];
    const n = Number(segs ?? 0);

    const coerente = (hasVoice === true) === n > 0 && (n === 0 || Number(semRound ?? 0) === 0);
    add(
      'voz: has_voice coerente com a tabela',
      coerente,
      n > 0
        ? `${talkers} falante(s), ${n} trechos, ${semRound} sem round`
        : `sem voz nesta demo (${String(source)}) — has_voice=${String(hasVoice)}`,
    );
  } catch (err) {
    add('voz: has_voice coerente com a tabela', false, String(err));
  }

  try {
    if (!matchId) throw new Error('nenhuma partida');
    const r = await invoke(
      'sql.query',
      {
        sql: `SELECT COUNT(*) AS arremessos,
                     SUM(CASE WHEN yaw IS NULL THEN 1 ELSE 0 END) AS sem_angulo,
                     SUM(CASE WHEN throw_strength IS NULL THEN 1 ELSE 0 END) AS sem_forca,
                     (SELECT COUNT(*) FROM grenades WHERE round_num IS NOT NULL) AS granadas
                FROM utility_throws`,
        maxRows: 1,
      },
      ctx,
    );
    const [throws = 0, noAngle = 0, noStrength = 0, grenades = 0] =
      (r.rows[0] ?? []).map(Number);

    add(
      'utilitarias extraidas com angulo e forca',
      throws > 0 && throws >= grenades * 0.9 && noAngle < throws * 0.1,
      `${throws} de ${grenades} granadas; ${noAngle} sem angulo, ${noStrength} sem forca`,
    );
  } catch (err) {
    add('utilitarias extraidas com angulo e forca', false, String(err));
  }

  try {
    const result = await invoke(
      'explore.query',
      {
        subject: 'kills',
        filters: [{ field: 'headshot', op: 'is', value: true }],
        groupBy: ['weapon'],
        measures: [{ agg: 'count' }],
        orderBy: null,
        limit: 200,
      },
      ctx,
    );
    const total = result.rows.reduce((sum, row) => sum + Number(row[1] ?? 0), 0);
    add(
      'explorador responde sem escrever SQL',
      result.rows.length > 0 && total > 0 && result.sql.includes('GROUP BY'),
      `${result.rows.length} armas, ${total} headshots`,
    );
  } catch (err) {
    add('explorador responde sem escrever SQL', false, String(err));
  }

  try {
    if (!matchId) throw new Error('nenhuma partida');
    const r = await invoke(
      'sql.query',
      {
        sql: `SELECT metric_id, COUNT(*) AS achados,
                     SUM(CASE WHEN baseline_kind IS NULL THEN 1 ELSE 0 END) AS sem_base
                FROM match_findings
               WHERE metric_id IN ('utility.unused_on_death', 'utility.nade_damage',
                                   'economy.left_on_table', 'economy.force_damage')
               GROUP BY metric_id`,
        maxRows: 10,
      },
      ctx,
    );
    const noBaseline = r.rows.reduce((sum, row) => sum + Number(row[2] ?? 0), 0);
    add(
      'regras novas de economia e utilitario com base',
      r.rows.length > 0 && noBaseline === 0,
      `${r.rows.length} metrica(s) nova(s): ${r.rows.map((row) => `${String(row[0]).split('.')[1]}=${String(row[1])}`).join(', ')}`,
    );
  } catch (err) {
    add('regras novas de economia e utilitario com base', false, String(err));
  }

  try {
    const players = await invoke('players.list', { query: '', limit: 60 }, ctx);

    const top = await invoke(
      'sql.query',
      { sql: 'SELECT steam_id FROM player_match ORDER BY kills DESC LIMIT 1', maxRows: 1 },
      ctx,
    );
    const steamId = String(top.rows[0]?.[0] ?? '');
    const profile = await invoke('player.profile', { steamId, lastMatches: 10 }, ctx);
    const empty = profile.series.filter((serie) => serie.points.length === 0).length;
    add(
      'tela Jogador responde com series e tabelas',
      players.length >= 10 &&
        profile.matches > 0 &&
        profile.series.length > 0 &&
        empty === 0 &&
        profile.byMap.length > 0 &&
        profile.byWeapon.length > 0,
      `${players.length} jogadores; ${profile.series.length} metrica(s), ` +
        `${profile.byMap.length} mapa(s), ${profile.byWeapon.length} arma(s)`,
    );
  } catch (err) {
    add('tela Jogador responde com series e tabelas', false, String(err));
  }

  try {
    const poi = (steamId: string) => ({
      playersOfInterest: [
        { steamId, displayName: 'portao', note: '', colour: '#22c55e' },
      ],
    });
    const all = await invoke('matches.list', { filter: 'all' }, ctx);
    const who = await invoke(
      'sql.query',
      { sql: 'SELECT steam_id FROM player_match LIMIT 1', maxRows: 1 },
      ctx,
    );

    await invoke('settings.set', poi(String(who.rows[0]?.[0] ?? '')), ctx);
    const comJogador = await invoke('matches.list', { filter: 'poi' }, ctx);

    await invoke('settings.set', poi('76561198999999999'), ctx);
    const comEstranho = await invoke('matches.list', { filter: 'poi' }, ctx);

    await invoke('settings.set', { playersOfInterest: [] }, ctx);

    add(
      'filtro de jogador de interesse filtra',
      all.length > 0 && comJogador.length === all.length && comEstranho.length === 0,
      `todas=${all.length}, com o jogador=${comJogador.length}, com estranho=${comEstranho.length}`,
    );
  } catch (err) {
    add('filtro de jogador de interesse filtra', false, String(err));
  }

  try {
    if (!matchId) throw new Error('nenhuma partida');
    const a = (await invoke('match.analysis', { matchId }, ctx)).accuracy;
    const top = [...a.players].sort((x, y) => y.shots - x.shots)[0];
    if (!top) throw new Error('nenhum disparo');

    const somaGrupos = Object.values(top.hitgroups).reduce((n, v) => n + v, 0);
    const semExcesso = a.players.every((p) => p.hits <= p.shots);
    add(
      'precisao: acertos atribuidos por tick',
      semExcesso && top.shots > 0 && top.hits > 0 && a.hasShotData && somaGrupos > 0,
      `${top.shots} tiros, ${top.hits} acertos, ${somaGrupos} com parte do corpo` +
        `, counter-strafe em ${top.judgedShots} tiros`,
    );
  } catch (err) {
    add('precisao: acertos atribuidos por tick', false, String(err));
  }

  try {
    if (!matchId) throw new Error('nenhuma partida');
    const r = (await invoke('match.analysis', { matchId }, ctx)).rounds;
    const detail = await invoke('match.get', { matchId }, ctx);
    const live = detail.rounds.filter((x) => x.phase === 'live').length;

    const comVantagem = r.advantages.reduce((n, a) => n + a.rounds, 0);
    const kastValido = r.kast.every((k) => k.kast !== null && k.kast >= 0 && k.kast <= 1);
    add(
      'rounds: clutch, vantagem e KAST',
      r.rounds === live && comVantagem > 0 && comVantagem <= live && kastValido && r.kast.length > 0,
      `${r.rounds} rounds live, ${comVantagem} com vantagem, ${r.clutches.length} jogador(es) em clutch`,
    );
  } catch (err) {
    add('rounds: clutch, vantagem e KAST', false, String(err));
  }

  try {
    if (!matchId) throw new Error('nenhuma partida');
    const detail = await invoke('match.get', { matchId }, ctx);
    const live = detail.rounds.filter((x) => x.phase === 'live');
    const round = live[Math.floor(live.length / 2)];
    if (!round) throw new Error('nenhum round live');

    const replay = await invoke('replay.round', { matchId, roundNum: round.roundNum }, ctx);
    const depois = Math.round((replay.endTick - (replay.hud.roundEndTick ?? replay.endTick)) / 8);
    add(
      'replay passa do fim do round',
      replay.hud.dataVersion >= 3 && replay.hud.roundEndTick !== null &&
        replay.endTick > replay.hud.roundEndTick,
      `round ${round.roundNum}: ${depois} quadro(s) de pos-round`,
    );
  } catch (err) {
    add('replay passa do fim do round', false, String(err));
  }

  try {
    const m = (await invoke('matches.list', {}, ctx))[0];
    if (!m) throw new Error('nenhuma partida');
    const fontes = ['filename', 'file_mtime'];
    add(
      'data da partida com a fonte declarada',
      m.playedAt !== null && m.playedAtSource !== null && fontes.includes(m.playedAtSource),
      `${m.playedAt?.slice(0, 16) ?? 'nula'} (${m.playedAtSource ?? 'sem fonte'})`,
    );
  } catch (err) {
    add('data da partida com a fonte declarada', false, String(err));
  }

  try {
    if (!matchId) throw new Error('nenhuma partida');
    const r = (await invoke('match.analysis', { matchId }, ctx)).rating;

    const esperado = (p: (typeof r.players)[number]) => {
      const impacto = 2.13 * p.kpr + 0.42 * p.apr - 0.41;
      return (
        0.0073 * (p.kast ?? 0) * 100 +
        0.3591 * p.kpr -
        0.5329 * p.dpr +
        0.2372 * impacto +
        0.0032 * p.adr +
        0.1587
      );
    };
    const comRating = r.players.filter((p) => p.rating !== null);
    const pior = comRating.reduce((max, p) => Math.max(max, Math.abs(p.rating! - esperado(p))), 0);
    const estados = await invoke(
      'sql.query',
      { sql: 'SELECT COUNT(*) FROM round_states', maxRows: 1 },
      ctx,
    );
    const nEstados = Number(estados.rows[0]?.[0] ?? 0);

    const silencio =
      r.baseline.states > 0 || r.players.every((p) => p.swingPerRound === null);
    add(
      'rating 2.0 aproximado e impacto de round',

      r.players.length >= 10 &&
        comRating.length === r.players.length &&
        pior < 0.01 &&
        nEstados > 0 &&
        r.baseline.minSample > 0 &&
        silencio,
      `erro max ${pior.toFixed(4)}; ${nEstados} estados, ` +
        `${r.baseline.states} com amostra >= ${r.baseline.minSample}` +
        (r.baseline.states === 0 ? ' — impacto se cala, como deve' : ''),
    );
  } catch (err) {
    add('rating 2.0 aproximado e impacto de round', false, String(err));
  }

  try {
    if (!matchId) throw new Error('nenhuma partida');
    const t = await invoke('team.match', { matchId }, ctx);
    const [a, b] = t.teams;
    const detail = await invoke('match.get', { matchId }, ctx);
    const live = detail.rounds.filter((x) => x.phase === 'live').length;
    const elencoA = new Set((a?.players ?? []).map((p) => p.steamId));
    const elencoB = new Set((b?.players ?? []).map((p) => p.steamId));
    const comuns = (b?.players ?? []).filter((p) => elencoA.has(p.steamId)).length;
    const vantagem = (a?.advantages.rounds ?? 0) + (b?.advantages.rounds ?? 0);
    add(
      'tela Time: dois elencos distintos e vantagem por time',

      t.teams.length === 2 &&
        comuns === 0 &&
        elencoA.size >= 5 &&
        elencoA.size + elencoB.size === detail.scoreboard.length &&
        a!.roundsWon + b!.roundsWon === live &&
        vantagem > 0 &&
        vantagem <= live &&
        a!.advantages.won <= a!.advantages.rounds &&
        b!.advantages.won <= b!.advantages.rounds,
      `${a?.teamName ?? 'Time A'} ${a?.roundsWon}x${b?.roundsWon} ${b?.teamName ?? 'Time B'}; ` +
        `elencos de ${elencoA.size} e ${elencoB.size}, ${comuns} em comum; ` +
        `vantagem em ${vantagem} de ${live} rounds`,
    );
  } catch (err) {
    add('tela Time: dois elencos distintos e vantagem por time', false, String(err));
  }

  try {
    const lineups = await invoke('team.lineups', {}, ctx);
    add(
      'elenco recorrente detectado',
      lineups.length > 0 && lineups.every((l) => l.players.length >= 5 && l.matches > 0),
      `${lineups.length} elenco(s); maior com ${Math.max(0, ...lineups.map((l) => l.players.length))} jogadores`,
    );
  } catch (err) {
    add('elenco recorrente detectado', false, String(err));
  }

  try {
    if (!matchId) throw new Error('nenhuma partida');
    const c = await invoke('match.chat', { matchId }, ctx);
    const detail = await invoke('match.get', { matchId }, ctx);
    const maxRound = Math.max(0, ...detail.rounds.map((x) => x.roundNum));
    const foraDeFaixa = c.messages.filter(
      (m) => m.roundNum !== null && (m.roundNum < 1 || m.roundNum > maxRound),
    ).length;
    const semEscopo = c.messages.filter((m) => m.isTeamOnly === null).length;
    add(
      'chat lido, com round, e com escopo coerente',
      !c.needsReprocess && foraDeFaixa === 0 && c.unknownScope === semEscopo,
      `${c.messages.length} mensagem(ns), ${c.unknownScope} sem escopo ` +
        `(${semEscopo} nulas), ${foraDeFaixa} fora da faixa de rounds`,
    );
  } catch (err) {
    add('chat lido, com round, e com escopo coerente', false, String(err));
  }

  try {
    if (!matchId) throw new Error('nenhuma partida');
    const detail = await invoke('match.get', { matchId }, ctx);
    const round = detail.rounds.find((x) => x.phase === 'live');
    if (!round) throw new Error('nenhum round live');
    const replay = await invoke('replay.round', { matchId, roundNum: round.roundNum }, ctx);
    const comCor = replay.slots.filter((s) => s.teamColor !== null).length;

    const foraDoTeto = replay.slots.filter((s) => s.slot >= replay.slotsPerFrame).length;
    const tamanhoOk = replay.x.length === replay.frames * replay.slotsPerFrame;
    const slotsUnicos = new Set(replay.slots.map((s) => s.slot)).size === replay.slots.length;
    add(
      'cor do jogador no time chega ao replay',
      replay.slots.length >= 10 &&
        comCor === replay.slots.length &&
        foraDoTeto === 0 &&
        slotsUnicos &&
        tamanhoOk,
      `${comCor} de ${replay.slots.length} slots com cor, passo ${replay.slotsPerFrame}` +
        (foraDoTeto > 0 ? `; ${foraDoTeto} FORA DO TETO` : '') +
        (slotsUnicos ? '' : '; SLOT REPETIDO'),
    );
  } catch (err) {
    add('cor do jogador no time chega ao replay', false, String(err));
  }

  try {
    if (!matchId) throw new Error('nenhuma partida');
    const u = (await invoke('match.analysis', { matchId }, ctx)).utility;
    const heComDano = u.throws.filter((t) => t.kind === 'he' && t.damage > 0).length;
    const flashQueCegou = u.throws.filter((t) => t.enemiesBlinded > 0).length;
    const fumacaZerada = u.throws
      .filter((t) => t.kind === 'smoke' || t.kind === 'decoy')
      .every((t) => t.damage === 0 && t.enemiesBlinded === 0);
    add(
      'utilitarias com o resultado de cada arremesso',
      u.hasDeepData && u.throws.length > 0 && heComDano > 0 && flashQueCegou > 0 && fumacaZerada,
      `${u.throws.length} arremessos: ${heComDano} HE com dano, ${flashQueCegou} flash que cegou; ` +
        `sem granada: ${u.unattributedDamage} de dano, ` +
        `${u.unattributedBlindSeconds.toFixed(1)}s de cegueira`,
    );
  } catch (err) {
    add('utilitarias com o resultado de cada arremesso', false, String(err));
  }

  try {
    const { readdirSync, readFileSync } = await import('node:fs');
    const dir = resolve(__dirname, 'web', 'assets');
    const js = readdirSync(dir)
      .filter((f) => f.endsWith('.js'))
      .map((f) => readFileSync(resolve(dir, f), 'utf8'))
      .join('');
    const temPt = js.includes('referência fixa');
    const temEn = js.includes('fixed reference');
    add(
      'catalogo pt-BR e en dentro do empacotado',
      temPt && temEn,
      `pt-BR ${temPt ? 'ok' : 'FALTA'}, en ${temEn ? 'ok' : 'FALTA'}`,
    );
  } catch (err) {
    add('catalogo pt-BR e en dentro do empacotado', false, String(err));
  }

  try {
    if (!matchId) throw new Error('nenhuma partida');
    const roster = await invoke('match.roster', { matchId }, ctx);
    const semCriterio = roster.handoffs.filter((h) => !h.inference).length;
    const semPonta = roster.handoffs.filter(
      (h) => h.outSteamId === null && h.inSteamId === null,
    ).length;
    const cru = JSON.stringify(roster).toLowerCase();
    const inventaMotivo = /"(reason|motivo|kicked|banned|ban)"/.test(cru);
    const janelasOk = roster.spells.every((s) => s.lastRound >= s.firstRound && s.rounds > 0);
    add(
      'troca de elenco responde, e sem inventar motivo',
      semCriterio === 0 && semPonta === 0 && !inventaMotivo && janelasOk,
      `${roster.spells.length} janela(s), ${roster.handoffs.length} troca(s), ` +
        `${roster.understaffedRounds.length} round(s) com elenco desigual` +
        (inventaMotivo ? '; PAYLOAD AFIRMA MOTIVO' : ''),
    );
  } catch (err) {
    add('troca de elenco responde, e sem inventar motivo', false, String(err));
  }

  {
    const licencas = [
      'NOTICE',
      'LICENSE',
      'licenses/geist.LICENSE',
      'licenses/csgo-voice-extractor.LICENSE',
      'licenses/opus.COPYING',
    ];
    const faltando = licencas.filter((f) => !existsSync(resolve(process.resourcesPath, f)));
    add(
      'licencas de terceiros instaladas',
      faltando.length === 0,
      faltando.length ? `faltam: ${faltando.join(', ')}` : `${licencas.length} conferidas`,
    );
  }

  return report(checks);
}

function report(checks: Check[]): number {
  const failed = checks.filter((c) => !c.ok);
  out('');
  out('  ' + '='.repeat(76));
  out(
    failed.length === 0
      ? `  PORTAO PASSOU — ${checks.length} verificacoes`
      : `  PORTAO FALHOU — ${failed.length} de ${checks.length} verificacoes`,
  );
  out('  ' + '='.repeat(76));
  out('');
  return failed.length === 0 ? 0 : 1;
}
