export interface RosterInstance {
  matchId: string;

  teamName: string | null;
  steamIds: string[];
}

export interface Lineup {

  id: string;

  name: string | null;

  instances: RosterInstance[];

  players: { steamId: string; matches: number }[];
}

export function overlap(a: readonly string[], b: readonly string[]): number {
  const set = new Set(a);
  let n = 0;
  for (const id of b) if (set.has(id)) n += 1;
  return n;
}

export const SAME_TEAM_OVERLAP = 3;

export const CORE_SIZE = 5;

export function groupLineups(
  instances: readonly RosterInstance[],
  minOverlap: number = SAME_TEAM_OVERLAP,
): Lineup[] {
  const groups: { members: RosterInstance[]; ids: Set<string> }[] = [];

  for (const instance of instances) {

    const touched = groups.filter((g) =>
      g.members.some((m) => overlap(m.steamIds, instance.steamIds) >= minOverlap),
    );
    if (touched.length === 0) {
      groups.push({ members: [instance], ids: new Set(instance.steamIds) });
      continue;
    }
    const first = touched[0]!;
    first.members.push(instance);
    for (const id of instance.steamIds) first.ids.add(id);
    for (const other of touched.slice(1)) {
      first.members.push(...other.members);
      for (const id of other.ids) first.ids.add(id);
      groups.splice(groups.indexOf(other), 1);
    }
  }

  return groups.map((g) => {
    const members = [...g.members].sort(
      (a, b) => instances.indexOf(a) - instances.indexOf(b),
    );
    const count = new Map<string, number>();
    for (const m of members) {
      for (const id of m.steamIds) count.set(id, (count.get(id) ?? 0) + 1);
    }
    const players = [...count.entries()]
      .map(([steamId, matches]) => ({ steamId, matches }))
      .sort((a, b) => b.matches - a.matches || a.steamId.localeCompare(b.steamId));

    const core = players
      .slice(0, CORE_SIZE)
      .map((p) => p.steamId)
      .sort();

    const named = [...members].reverse().find((m) => m.teamName);
    return {
      id: core.join('|'),
      name: named?.teamName ?? null,
      instances: members,
      players,
    };
  });
}
