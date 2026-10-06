import { describe, expect, it } from 'vitest';
import { groupLineups, overlap, type RosterInstance } from '../src/analytics/rosters.js';

const inst = (matchId: string, ids: string[], teamName: string | null = null): RosterInstance => ({
  matchId,
  teamName,
  steamIds: ids,
});

const CINCO = ['a', 'b', 'c', 'd', 'e'];

describe('overlap', () => {
  it('conta os jogadores em comum', () => {
    expect(overlap(CINCO, ['a', 'b', 'c'])).toBe(3);
    expect(overlap(CINCO, ['x', 'y'])).toBe(0);
  });
});

describe('groupLineups', () => {
  it('o mesmo elenco em duas partidas e UM time', () => {
    const g = groupLineups([inst('m1', CINCO), inst('m2', CINCO)]);
    expect(g).toHaveLength(1);
    expect(g[0]!.instances.map((i) => i.matchId)).toEqual(['m1', 'm2']);
  });

  it('tres em comum ja e o mesmo time: dois reservas nao quebram o historico', () => {
    const g = groupLineups([inst('m1', CINCO), inst('m2', ['a', 'b', 'c', 'x', 'y'])]);
    expect(g).toHaveLength(1);
  });

  it('dois em comum NAO e o mesmo time: dupla que roda nao cola grupos', () => {
    const g = groupLineups([inst('m1', CINCO), inst('m2', ['a', 'b', 'x', 'y', 'z'])]);
    expect(g).toHaveLength(2);
  });

  it('a juncao e transitiva: o elenco que troca aos poucos continua o mesmo', () => {
    const g = groupLineups([
      inst('m1', CINCO),
      inst('m2', ['a', 'b', 'c', 'x', 'y']),
      inst('m3', ['a', 'x', 'y', 'z', 'w']),
    ]);
    expect(g).toHaveLength(1);
    expect(g[0]!.instances).toHaveLength(3);
  });

  it('times sem nenhum jogador em comum ficam separados', () => {
    const g = groupLineups([inst('m1', CINCO), inst('m2', ['v', 'w', 'x', 'y', 'z'])]);
    expect(g.map((x) => x.instances.length)).toEqual([1, 1]);
  });

  it('o nome e o MAIS RECENTE que o elenco usou', () => {
    const g = groupLineups([inst('m1', CINCO, 'Nome Velho'), inst('m2', CINCO, 'Nome Novo')]);
    expect(g[0]!.name).toBe('Nome Novo');
  });

  it('elenco sem nome nenhum nao inventa um', () => {
    expect(groupLineups([inst('m1', CINCO)])[0]!.name).toBeNull();
  });

  it('o id sai do nucleo, e NAO muda quando entra um reserva', () => {
    const so = groupLineups([inst('m1', CINCO)])[0]!;
    const com = groupLineups([inst('m1', CINCO), inst('m2', ['a', 'b', 'c', 'd', 'x'])])[0]!;
    expect(so.id).toBe(CINCO.join('|'));
    expect(com.id).toBe(so.id);
  });

  it('elenco de seis tem id de CINCO ids', () => {
    const g = groupLineups([inst('m1', [...CINCO, 'f'])])[0]!;
    expect(g.id.split('|')).toHaveLength(5);
    expect(g.players).toHaveLength(6);
  });

  it('o id nao muda quando a segunda partida troca o reserva', () => {
    const a = groupLineups([
      inst('m1', [...CINCO, 'f']),
      inst('m2', [...CINCO, 'g']),
    ])[0]!;
    const b = groupLineups([inst('m1', CINCO)])[0]!;
    expect(a.id).toBe(b.id);
  });

  it('nao cola grupo alheio por tres em comum com o ACUMULADO', () => {

    const g = groupLineups([
      inst('m1', ['a', 'b', 'c', 'd', 'e']),
      inst('m2', ['c', 'd', 'e', 'f', 'g']),
      inst('m3', ['a', 'b', 'f', 'x', 'y']),
    ]);
    expect(g).toHaveLength(2);

    expect(g.find((x) => x.instances.length === 2)!.instances.map((i) => i.matchId))
      .toEqual(['m1', 'm2']);
  });

  it('conta em quantas partidas cada jogador apareceu', () => {
    const g = groupLineups([inst('m1', CINCO), inst('m2', ['a', 'b', 'c', 'x', 'y'])])[0]!;
    expect(g.players.find((p) => p.steamId === 'a')!.matches).toBe(2);
    expect(g.players.find((p) => p.steamId === 'x')!.matches).toBe(1);
  });
});
