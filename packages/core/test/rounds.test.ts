import { describe, expect, it } from 'vitest';
import { liveRounds, segmentRounds, type RawRoundEnd } from '../src/rounds.js';

const end = (tick: number, winner: string | null, gameRound: number | null = null): RawRoundEnd => ({
  tick,
  winner,
  reason: winner ? 'ct_killed' : null,
  gameRound,
});

describe('segmentRounds — caso Valve MM (sem round faca)', () => {
  it('trata todos os rounds como live quando ha um unico match_start', () => {
    const s = segmentRounds({
      matchStartTicks: [1000],
      startTicks: [900, 2000, 3000],
      freezeEndTicks: [1000, 2100, 3100],
      ends: [end(1900, 'CT'), end(2900, 'T'), end(3900, 'CT')],
    });

    expect(s.matchStartTick).toBe(1000);
    expect(s.restartCount).toBe(0);
    expect(s.knifeRoundTick).toBeNull();
    expect(s.liveRoundCount).toBe(3);
    expect(liveRounds(s).map((r) => r.roundNum)).toEqual([1, 2, 3]);
    expect(s.ctRoundsWon).toBe(2);
    expect(s.tRoundsWon).toBe(1);
  });
});

describe('segmentRounds — caso Gamers Club / FACEIT (round faca + restart)', () => {
  const input = {
    matchStartTicks: [7751, 12754],
    startTicks: [1, 7000, 13000, 20000],
    freezeEndTicks: [7751, 13100, 20100],
    ends: [
      end(1, null),
      end(9528, 'CT', 1),
      end(16642, 'CT', 2),
      end(21762, 'T', 3),
    ],
  };

  it('usa o ULTIMO match_start como fronteira', () => {
    expect(segmentRounds(input).matchStartTick).toBe(12754);
  });

  it('conta o restart', () => {
    expect(segmentRounds(input).restartCount).toBe(1);
  });

  it('descarta o round_end espurio do tick 1', () => {
    const s = segmentRounds(input);
    expect(s.rounds.some((r) => r.endTick === 1)).toBe(false);
  });

  it('identifica o round faca e NAO o conta como live', () => {
    const s = segmentRounds(input);
    expect(s.knifeRoundTick).toBe(9528);
    const knife = s.rounds.find((r) => r.endTick === 9528)!;
    expect(knife.phase).toBe('knife');
    expect(knife.roundNum).toBeNull();
  });

  it('renumera os rounds live a partir de 1, ignorando o numero do jogo', () => {
    const live = liveRounds(segmentRounds(input));
    expect(live.map((r) => r.roundNum)).toEqual([1, 2]);

    expect(live.map((r) => r.gameRoundNum)).toEqual([2, 3]);
  });

  it('o primeiro round live e o pistol round, nao o round faca', () => {
    const live = liveRounds(segmentRounds(input));
    expect(live[0]!.endTick).toBe(16642);
  });

  it('nao conta o round faca no placar', () => {
    const s = segmentRounds(input);
    expect(s.ctRoundsWon).toBe(1);
    expect(s.tRoundsWon).toBe(1);
    expect(s.liveRoundCount).toBe(2);
  });
});

describe('segmentRounds — restarts multiplos', () => {
  it('so o ultimo match_start vale; os rounds do meio viram descarte', () => {
    const s = segmentRounds({
      matchStartTicks: [1000, 5000, 9000],
      startTicks: [900, 4000, 8000, 10000],
      freezeEndTicks: [1000, 5000, 9000, 10100],
      ends: [
        end(2000, 'CT'),
        end(6000, 'T'),
        end(11000, 'CT'),
      ],
    });

    expect(s.matchStartTick).toBe(9000);
    expect(s.restartCount).toBe(2);
    expect(s.knifeRoundTick).toBe(6000);

    const phases = s.rounds.map((r) => r.phase);
    expect(phases).toEqual(['restart_discarded', 'knife', 'live']);
    expect(s.liveRoundCount).toBe(1);
  });

  it('rounds antes do PRIMEIRO match_start sao aquecimento', () => {
    const s = segmentRounds({
      matchStartTicks: [5000, 9000],
      startTicks: [100, 4000, 8000, 10000],
      freezeEndTicks: [200, 5000, 9000],
      ends: [end(500, 'T'), end(6000, 'CT'), end(11000, 'CT')],
    });
    expect(s.rounds.map((r) => r.phase)).toEqual(['warmup', 'knife', 'live']);
  });
});

describe('segmentRounds — deteccao de faca por inventario tem prioridade', () => {
  it('usa a dica em vez da heuristica', () => {
    const s = segmentRounds({
      matchStartTicks: [1000, 9000],
      startTicks: [900, 2000, 5000, 10000],
      freezeEndTicks: [1000, 2100, 5100, 10100],
      ends: [end(3000, 'CT'), end(6000, 'T'), end(11000, 'CT')],

      knifeRoundTicks: [3000],
    });
    expect(s.knifeRoundTick).toBe(3000);
    expect(s.rounds.find((r) => r.endTick === 3000)!.phase).toBe('knife');
    expect(s.rounds.find((r) => r.endTick === 6000)!.phase).toBe('restart_discarded');
  });
});

describe('segmentRounds — casos degenerados', () => {
  it('sem match_start nenhum, cai no primeiro freeze_end', () => {
    const s = segmentRounds({
      matchStartTicks: [],
      startTicks: [100],
      freezeEndTicks: [500, 3000],
      ends: [end(2000, 'CT'), end(4000, 'T')],
    });
    expect(s.matchStartTick).toBe(500);
    expect(s.liveRoundCount).toBe(2);
    expect(s.knifeRoundTick).toBeNull();
  });

  it('demo sem nenhum round nao quebra', () => {
    const s = segmentRounds({
      matchStartTicks: [],
      startTicks: [],
      freezeEndTicks: [],
      ends: [],
    });
    expect(s.rounds).toEqual([]);
    expect(s.liveRoundCount).toBe(0);
    expect(s.matchStartTick).toBe(0);
  });

  it('ignora round_end sem vencedor em qualquer posicao', () => {
    const s = segmentRounds({
      matchStartTicks: [100],
      startTicks: [50],
      freezeEndTicks: [100],
      ends: [end(500, null), end(1000, 'CT'), end(1500, null)],
    });
    expect(s.rounds).toHaveLength(1);
  });

  it('aceita os eventos fora de ordem', () => {
    const s = segmentRounds({
      matchStartTicks: [1000],
      startTicks: [3000, 900, 2000],
      freezeEndTicks: [3100, 1000, 2100],
      ends: [end(3900, 'CT'), end(1900, 'T'), end(2900, 'CT')],
    });
    expect(s.rounds.map((r) => r.endTick)).toEqual([1900, 2900, 3900]);
    expect(liveRounds(s).map((r) => r.roundNum)).toEqual([1, 2, 3]);
  });
});

describe('segmentRounds — metades e prorrogacao', () => {
  it('divide em metades de 12 e marca a prorrogacao', () => {
    const ends: RawRoundEnd[] = [];
    for (let i = 1; i <= 26; i++) ends.push(end(1000 + i * 100, i % 2 ? 'CT' : 'T'));

    const live = liveRounds(
      segmentRounds({ matchStartTicks: [1000], startTicks: [900], freezeEndTicks: [1000], ends }),
    );

    expect(live[0]!.half).toBe(1);
    expect(live[11]!.half).toBe(1);
    expect(live[12]!.half).toBe(2);
    expect(live[23]!.isOvertime).toBe(false);
    expect(live[24]!.isOvertime).toBe(true);
  });
});

describe('segmentRounds — fronteiras de tick por round', () => {
  it('associa start e freeze_end ao round certo, sem vazar do anterior', () => {
    const s = segmentRounds({
      matchStartTicks: [1000],
      startTicks: [900, 2000, 3000],
      freezeEndTicks: [1000, 2100, 3100],
      ends: [end(1900, 'CT'), end(2900, 'T'), end(3900, 'CT')],
      officialEndTicks: [1950, 2950, 3950],
    });

    const live = liveRounds(s);
    expect(live[0]).toMatchObject({ startTick: 900, freezeEndTick: 1000, officialEndTick: 1950 });
    expect(live[1]).toMatchObject({ startTick: 2000, freezeEndTick: 2100, officialEndTick: 2950 });
    expect(live[2]).toMatchObject({ startTick: 3000, freezeEndTick: 3100, officialEndTick: 3950 });
  });
});
