import type { MatchSummary } from '@cs2/contract';

export function wouldPrune(matches: MatchSummary[], keep: number): number {
  if (keep <= 0) return 0;
  const unpinned = [...matches]
    .filter((m) => !m.pinned)
    .sort((a, b) => b.ingestedAt.localeCompare(a.ingestedAt));
  return unpinned.slice(keep).filter((m) => m.bulkState !== 'pruned').length;
}
