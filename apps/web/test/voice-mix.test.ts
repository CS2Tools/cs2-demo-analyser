import { describe, expect, it } from 'vitest';
import { computeMix, emptyMix, isAudible, type MixState } from '../src/components/replay/voice-mix';

const talkers = [
  { steamId: 'a1', team: 'A' as const }, { steamId: 'a2', team: 'A' as const },
  { steamId: 'a3', team: 'A' as const }, { steamId: 'a4', team: 'A' as const },
  { steamId: 'a5', team: 'A' as const },
  { steamId: 'b1', team: 'B' as const }, { steamId: 'b2', team: 'B' as const },
];

const mix = (patch: (m: MixState) => void) => {
  const m = emptyMix();
  patch(m);
  return m;
};

describe('computeMix', () => {
  it('padrao: todo mundo audivel em volume 1', () => {
    const g = computeMix(emptyMix(), talkers);
    expect(g.team).toEqual({ A: 1, B: 1 });
    expect(Object.values(g.player).every((v) => v === 1)).toBe(true);
  });

  it('mutar o time A silencia os 5 de uma vez; o time B segue', () => {
    const g = computeMix(mix((m) => { m.teams.A.muted = true; }), talkers);
    const audible = talkers.filter((t) => isAudible(g, t.steamId, t.team)).map((t) => t.steamId);
    expect(audible).toEqual(['b1', 'b2']);
  });

  it('volume do time e do jogador sao independentes', () => {
    const g = computeMix(mix((m) => { m.teams.B.volume = 0.5; m.players.b1 = { volume: 1.5, muted: false }; }), talkers);
    expect(g.team.B).toBe(0.5);
    expect(g.player.b1).toBe(1.5);
  });

  it('solo: so ele toca — os outros 6 ficam mudos', () => {
    const g = computeMix(mix((m) => { m.solo = 'a3'; }), talkers);
    const audible = talkers.filter((t) => isAudible(g, t.steamId, t.team)).map((t) => t.steamId);
    expect(audible).toEqual(['a3']);
  });

  it('solo passa por cima do mudo do time e do proprio mudo', () => {
    const g = computeMix(mix((m) => {
      m.teams.A.muted = true;
      m.players.a3 = { volume: 0.7, muted: true };
      m.solo = 'a3';
    }), talkers);
    expect(isAudible(g, 'a3', 'A')).toBe(true);
    expect(g.player.a3).toBe(0.7);
  });

  it('volume por jogador fica entre 0 e 150%', () => {
    const g = computeMix(mix((m) => { m.players.a1 = { volume: 9, muted: false }; m.players.a2 = { volume: -1, muted: false }; }), talkers);
    expect(g.player.a1).toBe(1.5);
    expect(g.player.a2).toBe(0);
  });
});
