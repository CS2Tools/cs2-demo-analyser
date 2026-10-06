import { describe, expect, it } from 'vitest';
import {
  playedAtFromFileName,
  playedAtPattern,
  resolvePlayedAt,
} from '../src/played-at.js';

const iso = (d: Date | null) =>
  d === null
    ? null
    : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

describe('playedAtFromFileName', () => {
  it('le o padrao da Gamers Club, com hora', () => {
    const nome = '2026-09-09__2258__1__27829555__de_overpass__team-a__vs__team-b.dem';
    expect(iso(playedAtFromFileName(nome))).toBe('2026-09-09 22:58');
    expect(playedAtPattern(nome)).toBe('gamersclub');
  });

  it('le data e hora em formato ISO comum', () => {
    expect(iso(playedAtFromFileName('demo_2026-03-01_19-45-02.dem'))).toBe('2026-03-01 19:45');
    expect(iso(playedAtFromFileName('2026-03-01 19-45.dem'))).toBe('2026-03-01 19:45');
  });

  it('le o formato compacto', () => {
    expect(iso(playedAtFromFileName('20260301-194502.dem'))).toBe('2026-03-01 19:45');
  });

  it('so a data vira meia-noite, e nao e descartada', () => {
    expect(iso(playedAtFromFileName('mapa-2026-03-01.dem'))).toBe('2026-03-01 00:00');
    expect(playedAtPattern('mapa-2026-03-01.dem')).toBe('date_only');
  });

  it('nome sem data nao vira data', () => {
    expect(playedAtFromFileName('mibr-vs-furia-m1-mirage.dem')).toBeNull();
    expect(playedAtFromFileName('match730_003712345678901234567_1234567890.dem')).toBeNull();
    expect(playedAtFromFileName('1-a1b2c3d4-e5f6-7890-abcd-ef1234567890-1-1.dem')).toBeNull();
    expect(playedAtPattern('mibr-vs-furia-m1-mirage.dem')).toBeNull();
  });

  it('data impossivel e recusada, em vez de escorregar para o mes seguinte', () => {

    expect(playedAtFromFileName('2026-02-31__1200__x.dem')).toBeNull();
    expect(playedAtFromFileName('2026-13-01__1200__x.dem')).toBeNull();
  });

  it('hora impossivel nao derruba a data: cai para so a data', () => {

    expect(iso(playedAtFromFileName('2026-03-01__2599__x.dem'))).toBe('2026-03-01 00:00');
    expect(playedAtPattern('2026-03-01__2599__x.dem')).toBe('date_only');
  });

  it('ano fora da existencia do CS2 e coincidencia de digitos, nao data', () => {
    expect(playedAtFromFileName('1999-01-01__1200__x.dem')).toBeNull();
  });
});

describe('resolvePlayedAt', () => {
  const mtime = new Date(2026, 0, 15, 10, 30);

  it('o nome do arquivo ganha da data de modificacao', () => {
    const r = resolvePlayedAt('2026-09-09__2258__x.dem', mtime)!;
    expect(r.source).toBe('filename');
    expect(iso(r.at)).toBe('2026-09-09 22:58');
  });

  it('sem padrao no nome, cai para a data de modificacao', () => {
    const r = resolvePlayedAt('mibr-vs-furia.dem', mtime)!;
    expect(r.source).toBe('file_mtime');
    expect(r.at).toEqual(mtime);
  });

  it('sem nome e sem mtime, nao ha data: a ordem de importacao continua valendo', () => {
    expect(resolvePlayedAt('mibr-vs-furia.dem', null)).toBeNull();
  });

  it('data no futuro e relogio errado, e nao vira data de partida', () => {
    const amanha = new Date(Date.now() + 24 * 3600 * 1000);
    expect(resolvePlayedAt('x.dem', amanha)).toBeNull();
  });
});
