import { describe, expect, it } from 'vitest';
import {
  C4_TIMER_REFERENCE_SECONDS,
  measureC4Timer,
  plantForRound,
  siteFromPlace,
  type BombEventInput,
} from '../src/bomb.js';

describe('siteFromPlace', () => {
  it('le a letra do nome do lugar que a demo grava', () => {
    expect(siteFromPlace('BombsiteA')).toBe('A');
    expect(siteFromPlace('BombsiteB')).toBe('B');
    expect(siteFromPlace('bombsite b')).toBe('B');
  });

  it('lugar sem site explicito fica nulo, nao chutado', () => {
    expect(siteFromPlace('UpperPark')).toBeNull();
    expect(siteFromPlace(null)).toBeNull();
  });
});

const round8 = { startTick: 58931, endTick: 63530 };
const round9 = { startTick: 63978, endTick: 70191 };
const events: BombEventInput[] = [
  { tick: 63831, type: 'planted' },
  { tick: 67567, type: 'planted' },
  { tick: 70191, type: 'exploded' },
];

describe('plantForRound', () => {
  it('ignora o plantio feito depois do fim do round anterior', () => {
    expect(plantForRound(events, round9)?.tick).toBe(67567);
  });

  it('o plantio pos-round nao pertence a round nenhum para o HUD', () => {
    expect(plantForRound(events, round8)).toBeNull();
  });
});

describe('measureC4Timer', () => {
  it('mede 41,0 s como na demo de referencia, sem se confundir com o plantio pos-round', () => {
    const r = measureC4Timer([round8, round9], events, 64);
    expect(r).toEqual({ seconds: 41, source: 'measured', samples: 1 });
  });

  it('usa a mediana: uma medicao torta nao arrasta o timer', () => {
    const rounds = [0, 1, 2].map((i) => ({ startTick: i * 10_000, endTick: i * 10_000 + 9_000 }));
    const ev: BombEventInput[] = [
      { tick: 1000, type: 'planted' }, { tick: 1000 + 2624, type: 'exploded' },
      { tick: 11000, type: 'planted' }, { tick: 11000 + 2624, type: 'exploded' },
      { tick: 21000, type: 'planted' }, { tick: 21000 + 5000, type: 'exploded' },
    ];
    expect(measureC4Timer(rounds, ev, 64).seconds).toBe(41);
  });

  it('a 128 tick, a mesma conta', () => {
    const r = measureC4Timer(
      [{ startTick: 0, endTick: 20_000 }],
      [{ tick: 1000, type: 'planted' }, { tick: 1000 + 5248, type: 'exploded' }],
      128,
    );
    expect(r.seconds).toBe(41);
  });

  it('sem explosao para medir, declara que usou a referencia', () => {
    const r = measureC4Timer([round9], [{ tick: 67567, type: 'planted' }, { tick: 68000, type: 'defused' }], 64);
    expect(r).toEqual({ seconds: C4_TIMER_REFERENCE_SECONDS, source: 'reference', samples: 0 });
  });
});
