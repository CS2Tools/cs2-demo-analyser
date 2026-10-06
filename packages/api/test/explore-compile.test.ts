import { describe, expect, it } from 'vitest';
import { compile, ExploreError, MAX_ROWS } from '../src/explore/compile.js';
import { SUBJECTS } from '../src/explore/catalog.js';

const tidy = (sql: string) => sql.replace(/\s+/g, ' ').trim();

describe('compile', () => {
  it('pergunta simples: kills por arma', () => {
    const out = compile({
      subject: 'kills',
      groupBy: ['weapon'],
      measures: [{ agg: 'count' }],
    });

    expect(tidy(out.sql)).toBe(
      'SELECT k.weapon AS "weapon", COUNT(*)::BIGINT AS "count" ' +
        'FROM kills k JOIN matches m ON m.match_id = k.match_id ' +
        'LEFT JOIN player_match pa ON pa.match_id = k.match_id AND pa.steam_id = k.attacker_steam_id ' +
        'LEFT JOIN player_match pv ON pv.match_id = k.match_id AND pv.steam_id = k.victim_steam_id ' +
        'WHERE k.round_num IS NOT NULL GROUP BY 1 ORDER BY 2 DESC NULLS LAST LIMIT 500',
    );
    expect(out.params).toEqual([]);
    expect(out.columns.map((c) => c.role)).toEqual(['group', 'measure']);
  });

  it('todo valor do usuario vira parametro, nunca texto de SQL', () => {
    const out = compile({
      subject: 'kills',
      filters: [
        { field: 'player', op: 'is', value: "Robert'); DROP TABLE kills;--" },
        { field: 'weapon', op: 'in', values: ['ak47', 'awp'] },
        { field: 'headshot', op: 'is', value: true },
        { field: 'distance', op: 'between', min: 100, max: 2000 },
      ],
      measures: [{ agg: 'count' }],
    });

    expect(out.sql).not.toContain('DROP');
    expect(out.sql).toContain('pa.name = ?');
    expect(out.sql).toContain('k.weapon IN (?, ?)');
    expect(out.sql).toContain('k.distance BETWEEN ? AND ?');
    expect(out.params).toEqual(["Robert'); DROP TABLE kills;--", 'ak47', 'awp', true, 100, 2000]);
  });

  it('o "contem" escapa curinga: procurar %_ nao vira busca por tudo', () => {
    const out = compile({
      subject: 'kills',
      filters: [{ field: 'player', op: 'contains', value: '100%_x' }],
      measures: [{ agg: 'count' }],
    });
    expect(out.params).toEqual(['%100\\%\\_x%']);
  });

  it('campo fora do catalogo e recusado, com o nome do campo', () => {
    expect(() =>
      compile({ subject: 'kills', groupBy: ['steam_id; DROP TABLE kills'], measures: [{ agg: 'count' }] }),
    ).toThrow(ExploreError);
    expect(() => compile({ subject: 'kills', groupBy: ['inexistente'] })).toThrow(/inexistente/);
    expect(() => compile({ subject: 'nao_existe' })).toThrow(/assunto desconhecido/);
  });

  it('campo que nao pode ser medido ou agrupado e recusado', () => {

    expect(() => compile({ subject: 'kills', groupBy: ['playerId'] })).toThrow(/agrupar/);

    expect(() =>
      compile({ subject: 'kills', measures: [{ agg: 'sum', field: 'weapon' }] }),
    ).toThrow(/medir weapon/);

    expect(() =>
      compile({ subject: 'kills', measures: [{ agg: 'avg', field: 'weapon' }] }),
    ).toThrow(/medir weapon/);
  });

  it('porcentagem so vale para campo de sim/nao', () => {
    const out = compile({
      subject: 'kills',
      groupBy: ['weapon'],
      measures: [{ agg: 'share', field: 'headshot' }],
    });
    expect(out.sql).toContain('SUM(CASE WHEN k.headshot THEN 1 ELSE 0 END)');
    expect(out.columns[1]!.pt).toBe('% Headshot');

    expect(() =>
      compile({ subject: 'kills', measures: [{ agg: 'share', field: 'distance' }] }),
    ).toThrow(/sim\/nao/);
  });

  it('ordenacao e por INDICE de coluna, nunca por texto', () => {
    const out = compile({
      subject: 'kills',
      groupBy: ['player'],
      measures: [{ agg: 'count' }],
      orderBy: { index: 0, dir: 'asc' },
    });
    expect(out.sql).toContain('ORDER BY 1 ASC NULLS LAST');

    const out2 = compile({
      subject: 'kills',
      groupBy: ['player'],
      measures: [{ agg: 'count' }],
      orderBy: { index: 99, dir: 'desc' },
    });
    expect(out2.sql).toContain('ORDER BY 1 DESC');
  });

  it('o limite tem teto, mesmo se a tela pedir mais', () => {
    const out = compile({ subject: 'kills', measures: [{ agg: 'count' }], limit: 99999 });
    expect(out.sql).toContain(`LIMIT ${MAX_ROWS}`);
  });

  it('no maximo dois agrupamentos', () => {
    expect(() =>
      compile({ subject: 'kills', groupBy: ['player', 'weapon', 'map'], measures: [{ agg: 'count' }] }),
    ).toThrow(/no m.ximo 2 agrupamentos/);
  });

  it('sem agrupamento nem medida, mostra as linhas e como abrir no replay', () => {
    const out = compile({ subject: 'kills', filters: [{ field: 'headshot', op: 'is', value: true }] });
    expect(out.columns.every((c) => c.role === 'detail')).toBe(true);
    expect(out.sql).toContain('AS "_matchId"');
    expect(out.replay).toEqual({ matchIdIndex: 10, roundIndex: 11, tickIndex: 12 });
  });

  it('todo assunto do catalogo compila com contagem simples', () => {
    for (const subject of SUBJECTS) {
      const out = compile({ subject: subject.id, measures: [{ agg: 'count' }] });
      expect(out.sql, subject.id).toContain('COUNT(*)');
      expect(out.params, subject.id).toEqual([]);
    }
  });

  it('"so eu" e "so meus jogadores" filtram a pessoa certa em cada assunto', () => {
    const kills = compile({
      subject: 'kills',
      filters: [{ field: 'isMe', op: 'is', value: true }],
      measures: [{ agg: 'count' }],
    });
    expect(kills.sql).toContain('pa.is_user = ?');
    expect(kills.params).toEqual([true]);

    const deaths = compile({
      subject: 'deaths',
      filters: [{ field: 'isPoi', op: 'is', value: true }],
      measures: [{ agg: 'count' }],
    });
    expect(deaths.sql).toContain('pv.is_poi = ?');

    for (const subject of ['economy', 'performance', 'utility', 'aim']) {
      const out = compile({
        subject,
        filters: [{ field: 'isMe', op: 'is', value: true }],
        measures: [{ agg: 'count' }],
      });
      expect(out.sql, subject).toContain('p.is_user = ?');
    }
  });

  it('em "rounds" nao existe jogador, e o atalho nao existe', () => {
    expect(() =>
      compile({
        subject: 'rounds',
        filters: [{ field: 'isMe', op: 'is', value: true }],
        measures: [{ agg: 'count' }],
      }),
    ).toThrow(/campo desconhecido em rounds: isMe/);
  });

  it('os campos novos nao empurram mapa e partida fora da tabela de detalhe', () => {
    const out = compile({ subject: 'economy' });
    expect(out.columns.map((c) => c.key)).toContain('map');
  });

  it('nenhum assunto le tabela de ticks', () => {
    for (const subject of SUBJECTS) {
      expect(subject.from, subject.id).not.toMatch(/ticks_/);
    }
  });
});
