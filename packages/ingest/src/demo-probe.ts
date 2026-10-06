import { parseHeader, parsePlayerInfo, parseTicks } from '@laihoe/demoparser2';
import { normalizeMapName, hasRadar } from '@cs2/radar';
import type { DemoSource } from '@cs2/core';

export interface DemoProbe {
  mapRaw: string;
  mapName: string;
  hasRadar: boolean;
  serverName: string;
  clientName: string;
  source: DemoSource;
  isPov: boolean;
  povReason: string | null;
  humanPlayerCount: number;
  players: { steamId: string; name: string; teamNumber: number }[];

  build: string | null;

  format: string | null;
}

export function probeDemo(demoPath: string): DemoProbe {
  const header = parseHeader(demoPath) as Record<string, unknown>;
  const rawPlayers = parsePlayerInfo(demoPath) as Record<string, unknown>[];

  const build = header['patch_version'] === undefined ? null : String(header['patch_version']);
  const format = header['demo_version_name'] === undefined
    ? null
    : String(header['demo_version_name']);

  const mapRaw = String(header['map_name'] ?? '');
  const mapName = normalizeMapName(mapRaw);
  const serverName = String(header['server_name'] ?? '');
  const clientName = String(header['client_name'] ?? '');

  const players = rawPlayers
    .filter((p) => p['is_fake_player'] !== true)
    .map((p) => ({
      steamId: String(p['steamid'] ?? ''),
      name: String(p['name'] ?? ''),
      teamNumber: Number(p['team_number'] ?? 0),
    }))
    .filter((p) => p.steamId !== '' && p.steamId !== '0');

  const povReason = detectPov(clientName, players.length);

  return {
    mapRaw,
    mapName,
    hasRadar: hasRadar(mapName),
    serverName,
    clientName,
    source: detectSource(serverName),
    isPov: povReason !== null,
    povReason,
    humanPlayerCount: players.length,
    players,
    build,
    format,
  };
}

export function detectPov(clientName: string, humanPlayerCount: number): string | null {
  if (!/sourcetv|gotv/i.test(clientName)) {
    return `client_name e "${clientName}", nao uma gravacao de servidor`;
  }
  if (humanPlayerCount < 10) {
    return `apenas ${humanPlayerCount} jogadores humanos`;
  }
  return null;
}

export function detectSource(serverName: string): DemoSource {
  const s = serverName.toLowerCase();
  if (s.includes('gamersclub')) return 'gamers_club';
  if (s.includes('faceit')) return 'faceit';
  if (s.includes('esea')) return 'unknown';
  if (s.includes('valve') || s.includes('counter-strike')) return 'valve_mm';
  return 'unknown';
}

export function inferTickRate(demoPath: string, lastTick: number): number {
  const a = Math.max(1, Math.floor(lastTick * 0.2));
  const b = Math.floor(lastTick * 0.8);
  if (b <= a) return 64;

  const probe = parseTicks(demoPath, ['game_time'], [a, b]) as Record<string, unknown>[];
  const at = Number(probe.find((r) => Number(r['tick']) === a)?.['game_time']);
  const bt = Number(probe.find((r) => Number(r['tick']) === b)?.['game_time']);

  if (!Number.isFinite(at) || !Number.isFinite(bt) || bt === at) return 64;
  const raw = (b - a) / (bt - at);
  return Math.abs(raw - 128) < Math.abs(raw - 64) ? 128 : 64;
}
