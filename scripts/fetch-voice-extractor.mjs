import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'vendor', 'csgo-voice-extractor', 'win32-x64');

const VERSION = 'v3.1.6';
const URL = `https://github.com/akiver/csgo-voice-extractor/releases/download/${VERSION}/win32-x64.zip`;
const ZIP_SHA256 = '1f5ad987e6aa0e207268992a169f87a6e78c64561353655e424676ee7bfdcb5b';
const FILES = {
  'csgove.exe': '57041d725c753ee5e9433b07528622237818c13a19488425d08ff657070db4a8',
  'opus.dll': 'f81646ea82b143e86bd3640d3cb3ff4fdbaaec83acb3b7f2c620c1d817ed76d8',
};

const PLACEHOLDERS = ['tier0.dll', 'vaudio_celt.dll'];

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const log = (s) => process.stdout.write(`${s}\n`);

function alreadyOk() {
  return (
    Object.entries(FILES).every(
      ([name, hash]) => existsSync(join(OUT, name)) && sha256(readFileSync(join(OUT, name))) === hash,
    ) && PLACEHOLDERS.every((p) => existsSync(join(OUT, p)))
  );
}

if (alreadyOk()) {
  log(`extrator de voz ${VERSION}: ja presente e verificado em ${OUT}`);
  process.exit(0);
}

let zip;
const local = process.argv[2];
if (local) {
  zip = readFileSync(local);
  log(`usando zip local: ${local}`);
} else {
  log(`baixando ${URL}`);
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`download falhou: HTTP ${res.status}`);
  zip = Buffer.from(await res.arrayBuffer());
}

if (sha256(zip) !== ZIP_SHA256) {
  throw new Error(`hash do zip nao confere (esperado ${ZIP_SHA256}). Abortando.`);
}

const entries = unzipSync(new Uint8Array(zip));
mkdirSync(OUT, { recursive: true });
for (const [name, hash] of Object.entries(FILES)) {
  const key = Object.keys(entries).find((k) => k.endsWith(`/${name}`) || k === name);
  if (!key) throw new Error(`${name} nao esta no zip`);
  const data = Buffer.from(entries[key]);
  if (sha256(data) !== hash) throw new Error(`hash de ${name} nao confere. Abortando.`);
  writeFileSync(join(OUT, name), data);
}
for (const p of PLACEHOLDERS) writeFileSync(join(OUT, p), Buffer.alloc(0));

log(`extrator de voz ${VERSION} pronto em ${OUT}`);
