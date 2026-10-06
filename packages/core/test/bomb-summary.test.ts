import { describe, expect, it } from 'vitest';
import { summarizeBomb, type BombRoundInput } from '../src/bomb.js';

const TICK = 64;
const C4 = 41;

const round = (patch: Partial<BombRoundInput> = {}): BombRoundInput => ({
  roundNum: 1,
  site: 'A',
  plantTick: 10_000,
  defuseTick: null,
  explodeTick: null,
  freezeEndTick: 10_000 - 30 * TICK,
  winnerSide: 'T',
  defuseWithKit: null,
  ...patch,
});

describe('resumo da bomba', () => {
  it('round sem plantio fica de fora', () => {
    const s = summarizeBomb([round({ plantTick: null }), round()], TICK, C4);
    expect(s.plants).toBe(1);
    expect(s.bySite).toHaveLength(1);
  });

  it('separa por site e conta quem levou o round plantado', () => {
    const s = summarizeBomb(
      [
        round({ site: 'A', winnerSide: 'T', explodeTick: 12_600 }),
        round({ site: 'A', winnerSide: 'CT', defuseTick: 12_000 }),
        round({ site: 'B', winnerSide: 'T' }),
      ],
      TICK,
      C4,
    );
    const a = s.bySite.find((x) => x.site === 'A')!;
    const b = s.bySite.find((x) => x.site === 'B')!;
    expect(a).toMatchObject({ plants: 2, tWon: 1, ctWon: 1, defused: 1, exploded: 1 });
    expect(b).toMatchObject({ plants: 1, tWon: 1, ctWon: 0 });
  });

  it('site desconhecido vira um grupo proprio, nao some', () => {
    const s = summarizeBomb([round({ site: null })], TICK, C4);
    expect(s.bySite[0]!.site).toBeNull();
    expect(s.bySite[0]!.plants).toBe(1);
  });

  it('tempo ate o plantio sai em segundos, pela mediana', () => {
    const s = summarizeBomb(
      [
        round({ freezeEndTick: 10_000 - 20 * TICK }),
        round({ freezeEndTick: 10_000 - 30 * TICK }),
        round({ freezeEndTick: 10_000 - 40 * TICK }),
      ],
      TICK,
      C4,
    );
    expect(s.bySite[0]!.medianPlantSeconds).toBe(30);
  });

  it('sem fim de freezetime, nao inventa tempo de plantio', () => {
    const s = summarizeBomb([round({ freezeEndTick: null })], TICK, C4);
    expect(s.bySite[0]!.medianPlantSeconds).toBeNull();
  });

  it('desarme: com kit, sem kit, e quanto sobrava da bomba', () => {
    const s = summarizeBomb(
      [

        round({ defuseTick: 10_000 + 31 * TICK, winnerSide: 'CT', defuseWithKit: true }),

        round({ defuseTick: 10_000 + 39 * TICK, winnerSide: 'CT', defuseWithKit: false }),
      ],
      TICK,
      C4,
    );
    expect([s.defusedWithKit, s.defusedWithoutKit]).toEqual([1, 1]);
    expect(s.medianSecondsLeftOnDefuse).toBe(6);
  });

  it('sem saber do kit, nao conta nem para um lado nem para o outro', () => {
    const s = summarizeBomb(
      [round({ defuseTick: 12_000, winnerSide: 'CT', defuseWithKit: null })],
      TICK,
      C4,
    );
    expect([s.defused, s.defusedWithKit, s.defusedWithoutKit]).toEqual([1, 0, 0]);
  });

  it('partida sem bomba nenhuma devolve zeros, nao erro', () => {
    const s = summarizeBomb([], TICK, C4);
    expect(s).toMatchObject({ plants: 0, defused: 0, exploded: 0 });
    expect(s.bySite).toEqual([]);
    expect(s.medianSecondsLeftOnDefuse).toBeNull();
  });
});
