import type { Side } from '../types.js';

export type SideByRound = Map<number, Map<string, Side>>;

export type TeamId = 'A' | 'B';

export interface TeamColoring {

  teamOf: Map<string, TeamId>;

  startingSideA: Side | null;

  unresolved: string[];
}

class ParityUnion {
  private readonly parent = new Map<string, string>();
  private readonly parity = new Map<string, 0 | 1>();

  private add(id: string): void {
    if (this.parent.has(id)) return;
    this.parent.set(id, id);
    this.parity.set(id, 0);
  }

  find(id: string): { root: string; parity: 0 | 1 } {
    this.add(id);
    let node = id;
    let acc: 0 | 1 = 0;
    while (this.parent.get(node) !== node) {
      acc = ((acc ^ this.parity.get(node)!) as 0 | 1);
      node = this.parent.get(node)!;
    }

    let walk = id;
    let walkParity: 0 | 1 = acc;
    while (this.parent.get(walk) !== walk) {
      const next = this.parent.get(walk)!;
      const nextParity = ((walkParity ^ this.parity.get(walk)!) as 0 | 1);
      this.parent.set(walk, node);
      this.parity.set(walk, walkParity);
      walk = next;
      walkParity = nextParity;
    }
    return { root: node, parity: acc };
  }

  union(a: string, b: string, same: boolean): void {
    const fa = this.find(a);
    const fb = this.find(b);
    if (fa.root === fb.root) return;

    const want = same ? 0 : 1;
    const x = ((fa.parity ^ fb.parity ^ want) as 0 | 1);
    this.parent.set(fb.root, fa.root);
    this.parity.set(fb.root, x);
  }

  has(id: string): boolean {
    return this.parent.has(id);
  }
}

export function colorTeamsFromRoster(sideByRound: SideByRound): TeamColoring {
  const union = new ParityUnion();
  const rounds = [...sideByRound.keys()].sort((a, b) => a - b);

  for (const roundNum of rounds) {
    const sides = sideByRound.get(roundNum)!;
    const first: Partial<Record<Side, string>> = {};
    for (const [steamId, side] of sides) {
      const anchorSame = first[side];
      if (anchorSame === undefined) first[side] = steamId;
      else union.union(anchorSame, steamId, true);
    }
    const ct = first.CT;
    const t = first.T;
    if (ct !== undefined && t !== undefined) union.union(ct, t, false);

    for (const [steamId] of sides) if (!union.has(steamId)) union.find(steamId);
  }

  let anchorRound: number | null = null;
  for (const roundNum of rounds) {
    const sides = sideByRound.get(roundNum)!;
    let hasCt = false;
    let hasT = false;
    for (const [, side] of sides) {
      if (side === 'CT') hasCt = true;
      else hasT = true;
      if (hasCt && hasT) break;
    }
    if (hasCt && hasT) {
      anchorRound = roundNum;
      break;
    }
  }

  const teamOf = new Map<string, TeamId>();
  const unresolved: string[] = [];
  if (anchorRound === null) {

    for (const sides of sideByRound.values()) {
      for (const steamId of sides.keys()) if (!unresolved.includes(steamId)) unresolved.push(steamId);
    }
    return { teamOf, startingSideA: null, unresolved };
  }

  const anchorSides = sideByRound.get(anchorRound)!;
  const anchorCt = [...anchorSides].find(([, side]) => side === 'CT')![0];
  const { root: anchorRoot, parity: anchorParity } = union.find(anchorCt);

  for (const sides of sideByRound.values()) {
    for (const steamId of sides.keys()) {
      if (teamOf.has(steamId)) continue;
      const { root, parity } = union.find(steamId);
      if (root !== anchorRoot) {
        if (!unresolved.includes(steamId)) unresolved.push(steamId);
        continue;
      }
      teamOf.set(steamId, parity === anchorParity ? 'A' : 'B');
    }
  }

  return { teamOf, startingSideA: 'CT', unresolved };
}

export const SPELL_GAP_TOLERANCE = 1;

export interface RosterSpell {
  steamId: string;
  spellSeq: number;
  teamSlot: TeamId | null;
  firstRound: number;
  lastRound: number;

  rounds: number;
}

export interface RosterHandoff {
  handoffSeq: number;
  teamSlot: TeamId;
  outSteamId: string | null;
  outLastRound: number | null;
  inSteamId: string | null;
  inFirstRound: number | null;

  gapRounds: number | null;
  inference: 'adjacent_window';
}

export function computeSpells(
  roundsOf: Map<string, number[]>,
  teamOf: Map<string, TeamId>,
): RosterSpell[] {
  const out: RosterSpell[] = [];
  for (const steamId of [...roundsOf.keys()].sort()) {
    const rounds = [...new Set(roundsOf.get(steamId)!)].sort((a, b) => a - b);
    if (rounds.length === 0) continue;

    let start = rounds[0]!;
    let prev = rounds[0]!;
    let count = 1;
    let seq = 0;
    const push = (last: number, n: number) => {
      out.push({
        steamId,
        spellSeq: seq++,
        teamSlot: teamOf.get(steamId) ?? null,
        firstRound: start,
        lastRound: last,
        rounds: n,
      });
    };

    for (const r of rounds.slice(1)) {
      if (r - prev - 1 > SPELL_GAP_TOLERANCE) {
        push(prev, count);
        start = r;
        count = 0;
      }
      prev = r;
      count += 1;
    }
    push(prev, count);
  }
  return out;
}

export function computeHandoffs(
  spells: RosterSpell[],
  liveRounds: number[],
): RosterHandoff[] {
  const ordered = [...new Set(liveRounds)].sort((a, b) => a - b);
  if (ordered.length === 0) return [];
  const first = ordered[0]!;
  const last = ordered[ordered.length - 1]!;
  const indexOf = new Map(ordered.map((r, i) => [r, i]));

  const out: RosterHandoff[] = [];
  let seq = 0;

  for (const slot of ['A', 'B'] as const) {
    const mine = spells.filter((s) => s.teamSlot === slot);
    const saidas = mine
      .filter((s) => s.lastRound < last)
      .sort((a, b) => a.lastRound - b.lastRound);
    const entradas = mine
      .filter((s) => s.firstRound > first)
      .sort((a, b) => a.firstRound - b.firstRound);

    const usadas = new Set<RosterSpell>();
    const pares: [RosterSpell, RosterSpell | null][] = [];

    for (const saida of saidas) {
      const par = entradas.find((e) => !usadas.has(e) && e.steamId !== saida.steamId) ?? null;
      if (par) usadas.add(par);
      pares.push([saida, par]);
    }

    const gap = (saida: RosterSpell, entrada: RosterSpell): number =>
      indexOf.get(entrada.firstRound)! - indexOf.get(saida.lastRound)! - 1;

    for (const [saida, entrada] of pares) {
      out.push({
        handoffSeq: seq++,
        teamSlot: slot,
        outSteamId: saida.steamId,
        outLastRound: saida.lastRound,
        inSteamId: entrada?.steamId ?? null,
        inFirstRound: entrada?.firstRound ?? null,
        gapRounds: entrada ? gap(saida, entrada) : null,
        inference: 'adjacent_window',
      });
    }

    for (const entrada of entradas) {
      if (usadas.has(entrada)) continue;
      out.push({
        handoffSeq: seq++,
        teamSlot: slot,
        outSteamId: null,
        outLastRound: null,
        inSteamId: entrada.steamId,
        inFirstRound: entrada.firstRound,
        gapRounds: null,
        inference: 'adjacent_window',
      });
    }
  }
  return out;
}
