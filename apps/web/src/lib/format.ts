export function cleanName(name: string): string {
  return name.replace(/^[^\p{L}\p{Nd}]+/u, '').trim() || name.trim();
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return '—';
  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatDateTime(iso: string, locale: string): string {
  const d = new Date(iso.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(d);
}

export const SOURCE_LABELS: Record<string, string> = {
  gamers_club: 'Gamers Club',
  faceit: 'FACEIT',
  valve_mm: 'Matchmaking',
  hltv: 'HLTV',
  unknown: 'Desconhecida',
};

export const WIN_REASON_LABELS: Record<string, string> = {
  t_killed: 'T eliminados',
  ct_killed: 'CT eliminados',
  bomb_exploded: 'Bomba explodiu',
  bomb_defused: 'Bomba desarmada',
  target_bombed: 'Bomba explodiu',
  target_saved: 'Tempo esgotado',
  hostages_rescued: 'Refens resgatados',
  hostages_not_rescued: 'Refens nao resgatados',
};
