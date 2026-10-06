import { describe, expect, it } from 'vitest';
import {
  breakPoints,
  buyConversion,
  economicImpact,
  forceBuyCosts,
  LOSS_BONUS_STEPS,
  lossBonusSeries,
  type BuyRound,
} from '../src/analytics/economy.js';

const r = (
  roundNum: number,
  winnerSide: 'CT' | 'T',
  patch: Partial<BuyRound> = {},
): BuyRound => ({
  roundNum,
  half: 1,
  winnerSide,
  ctBuyType: null,
  tBuyType: null,
  ...patch,
});

describe('lossBonusSeries', () => {
  it('a pistola vale 1900 para quem perde: o contador comeca em 1', () => {
    const s = lossBonusSeries([r(1, 'CT')]);
    expect(s[0]).toMatchObject({ roundNum: 1, ct: 1900, t: 1900 });
  });

  it('sobe 500 por derrota seguida, ate o teto de 3400', () => {
    const rounds = [1, 2, 3, 4, 5, 6].map((n) => r(n, 'CT'));
    const t = lossBonusSeries(rounds).map((x) => x.t);
    expect(t).toEqual([1900, 2400, 2900, 3400, 3400, 3400]);
    expect(LOSS_BONUS_STEPS.at(-1)).toBe(3400);
  });

  it('vitoria desce um degrau, nao zera', () => {

    const rounds = [r(1, 'CT'), r(2, 'CT'), r(3, 'CT'), r(4, 'T'), r(5, 'CT')];
    const t = lossBonusSeries(rounds).map((x) => x.t);
    expect(t).toEqual([1900, 2400, 2900, 3400, 2900]);
  });

  it('nao desce abaixo do primeiro degrau', () => {
    const rounds = [r(1, 'CT'), r(2, 'CT'), r(3, 'CT')];
    expect(lossBonusSeries(rounds).map((x) => x.ct)).toEqual([1900, 1400, 1400]);
  });

  it('o contador recomeca na segunda metade', () => {
    const rounds = [
      r(1, 'CT'), r(2, 'CT'), r(3, 'CT'),
      r(4, 'CT', { half: 2 }),
    ];
    const s = lossBonusSeries(rounds);
    expect(s.map((x) => x.t)).toEqual([1900, 2400, 2900, 1900]);
  });
});

describe('breakPoints', () => {
  it('marca o round de full buy seguido de eco', () => {
    const rounds = [
      r(1, 'T', { ctBuyType: 'full_buy', tBuyType: 'full_buy' }),
      r(2, 'T', { ctBuyType: 'eco', tBuyType: 'full_buy' }),
    ];
    expect(breakPoints(rounds)).toEqual([{ roundNum: 1, side: 'CT', nextBuyType: 'eco' }]);
  });

  it('nao atravessa a troca de lado', () => {
    const rounds = [
      r(1, 'T', { ctBuyType: 'full_buy', tBuyType: 'full_buy' }),
      r(2, 'T', { half: 2, ctBuyType: 'eco', tBuyType: 'eco' }),
    ];
    expect(breakPoints(rounds)).toEqual([]);
  });

  it('force nao e break: o time escolheu gastar', () => {
    const rounds = [
      r(1, 'T', { ctBuyType: 'force_buy', tBuyType: 'full_buy' }),
      r(2, 'T', { ctBuyType: 'eco', tBuyType: 'full_buy' }),
    ];
    expect(breakPoints(rounds)).toEqual([]);
  });
});

describe('forceBuyCosts', () => {
  it('conta quantos rounds o force perdido atrasou o full buy', () => {
    const rounds = [
      r(1, 'CT', { tBuyType: 'force_buy' }),
      r(2, 'CT', { tBuyType: 'eco' }),
      r(3, 'CT', { tBuyType: 'semi_eco' }),
      r(4, 'T', { tBuyType: 'full_buy' }),
    ];
    expect(forceBuyCosts(rounds)).toEqual([
      { roundNum: 1, side: 'T', won: false, roundsUntilFullBuy: 3 },
    ]);
  });

  it('force vencido tambem aparece, com o que veio depois', () => {
    const rounds = [
      r(1, 'T', { tBuyType: 'force_buy' }),
      r(2, 'T', { tBuyType: 'full_buy' }),
    ];
    expect(forceBuyCosts(rounds)).toEqual([
      { roundNum: 1, side: 'T', won: true, roundsUntilFullBuy: 1 },
    ]);
  });

  it('sem full buy ate o fim da metade, fica nulo em vez de chutar', () => {
    const rounds = [
      r(1, 'CT', { tBuyType: 'force_buy' }),
      r(2, 'CT', { tBuyType: 'eco' }),
      r(3, 'T', { half: 2, tBuyType: 'full_buy' }),
    ];
    expect(forceBuyCosts(rounds)[0]!.roundsUntilFullBuy).toBeNull();
  });
});

describe('buyConversion', () => {
  it('taxa de vitoria por tipo de compra e por lado', () => {
    const rounds = [
      r(1, 'T', { ctBuyType: 'eco', tBuyType: 'full_buy' }),
      r(2, 'CT', { ctBuyType: 'eco', tBuyType: 'full_buy' }),
      r(3, 'CT', { ctBuyType: 'full_buy', tBuyType: 'eco' }),
    ];
    const conv = buyConversion(rounds);
    expect(conv).toContainEqual({ side: 'CT', buyType: 'eco', rounds: 2, won: 1 });
    expect(conv).toContainEqual({ side: 'T', buyType: 'eco', rounds: 1, won: 0 });
  });
});

describe('economicImpact', () => {
  const players = [
    { roundNum: 1, steamId: 'ct1', side: 'CT' as const, startBalance: 6000, spent: 4000, equipValue: 4700, survived: true },
    { roundNum: 1, steamId: 'ct2', side: 'CT' as const, startBalance: 5000, spent: 800, equipValue: 1000, survived: false },
    { roundNum: 1, steamId: 't1', side: 'T' as const, startBalance: 3000, spent: 2900, equipValue: 3100, survived: false },
  ];
  const teamBuyType = [
    { roundNum: 1, side: 'CT' as const, buyType: 'full_buy' as const },
    { roundNum: 1, side: 'T' as const, buyType: 'force_buy' as const },
  ];

  it('equipamento destruido e o que a vitima trouxe para o round', () => {
    const out = economicImpact({
      players,
      teamBuyType,
      kills: [{ roundNum: 1, victimSteamId: 't1', attackerSteamId: 'ct1', attackerSide: 'CT' }],
    });
    expect(out.bySide.find((s) => s.side === 'CT')!.equipDestroyed).toBe(3100);
    expect(out.byPlayer.find((p) => p.steamId === 'ct1')!.equipDestroyed).toBe(3100);
  });

  it('fogo amigo nao conta como dano economico ao adversario', () => {
    const out = economicImpact({
      players,
      teamBuyType,
      kills: [{ roundNum: 1, victimSteamId: 'ct2', attackerSteamId: 'ct1', attackerSide: 'CT' }],
    });
    expect(out.bySide.find((s) => s.side === 'CT')!.equipDestroyed).toBe(0);
  });

  it('equipamento salvo e o de quem sobreviveu', () => {
    const out = economicImpact({ players, teamBuyType, kills: [] });
    expect(out.bySide.find((s) => s.side === 'CT')!.equipSaved).toBe(4700);
    expect(out.bySide.find((s) => s.side === 'T')!.equipSaved).toBe(0);
  });

  it('dinheiro na mesa so conta em round de full buy do proprio time', () => {
    const out = economicImpact({ players, teamBuyType, kills: [] });

    expect(out.bySide.find((s) => s.side === 'CT')!.leftOnTable).toBe(6200);

    expect(out.bySide.find((s) => s.side === 'T')!.leftOnTable).toBe(0);
    expect(out.byPlayer.find((p) => p.steamId === 'ct2')!.leftOnTable).toBe(4200);
  });
});
