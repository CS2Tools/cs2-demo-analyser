import { describe, expect, it } from 'vitest';
import type { Segmentation, SegmentedRound } from '@cs2/core';
import { replayEndTick, sampleTicks } from '../src/pass-c.js';

const round = (patch: Partial<SegmentedRound>): SegmentedRound => ({
  roundNum: 1,
  gameRoundNum: 1,
  phase: 'live',
  startTick: 1000,
  freezeEndTick: 1100,
  endTick: 2000,
  officialEndTick: 2320,
  winnerSide: 'CT',
  winReason: 'ct_killed',
  half: 1,
  isOvertime: false,
  ...patch,
});

const segmentation = (rounds: SegmentedRound[]): Segmentation => ({
  matchStartTick: 0,
  restartCount: 0,
  knifeRoundTick: null,
  rounds,
  liveRoundCount: rounds.filter((r) => r.phase === 'live').length,
  ctRoundsWon: 0,
  tRoundsWon: 0,
});

describe('janela do replay', () => {
  it('vai ate o fim OFICIAL do round, nao ate a ultima kill', () => {
    expect(replayEndTick({ endTick: 2000, officialEndTick: 2320 })).toBe(2320);
    const ticks = sampleTicks(segmentation([round({})]), 8);
    expect(Math.max(...ticks)).toBe(2320);

    expect(ticks.filter((t) => t > 2000).length).toBeGreaterThan(30);
  });

  it('demo sem o evento oficial continua parando no round_end', () => {
    expect(replayEndTick({ endTick: 2000, officialEndTick: null })).toBe(2000);
    const ticks = sampleTicks(segmentation([round({ officialEndTick: null })]), 8);
    expect(Math.max(...ticks)).toBe(2000);
  });

  it('fim oficial mais cedo que o round_end nao encurta o replay', () => {
    expect(replayEndTick({ endTick: 2000, officialEndTick: 1900 })).toBe(2000);
  });

  it('aquecimento e round faca continuam fora do replay', () => {
    const ticks = sampleTicks(
      segmentation([
        round({ roundNum: null, phase: 'warmup', startTick: 0, endTick: 500, officialEndTick: 600 }),
        round({ roundNum: null, phase: 'knife', startTick: 600, endTick: 900, officialEndTick: 950 }),
        round({}),
      ]),
      8,
    );
    expect(Math.min(...ticks)).toBe(1000);
  });

  it('o ultimo tick entra mesmo quando nao cai na grade do stride', () => {
    const ticks = sampleTicks(segmentation([round({ endTick: 2000, officialEndTick: 2321 })]), 8);

    expect(ticks).toContain(2321);
  });
});
