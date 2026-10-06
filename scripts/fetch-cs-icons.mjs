import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'vendor', 'counter-strike-icons');
const MANIFEST = join(OUT, 'manifest.json');

const REPO = 'Juknum/counter-strike-icons';
const COMMIT = '10a0ddc810649147e08be670ce8ecf61ecc30614';
const BASE = 'cs2/panorama/images';

const SELECTION = [

  { from: 'icons/equipment', to: 'equipment', keep: () => true },

  {
    from: 'hud/deathnotice',
    to: 'deathnotice',
    keep: (f) => ['icon_headshot', 'penetrate', 'smoke_kill', 'blind_kill', 'noscope', 'inairkill', 'icon_suicide']
      .includes(f.replace(/\.svg$/, '')),
  },

  { from: 'map_icons', to: 'maps', keep: (f) => /^map_icon_de_[a-z0-9]+\.svg$/.test(f) && !f.includes('_night') },

  { from: 'hud/radar', to: 'radar', keep: (f) => ['radarctlogo.svg', 'radartlogo.svg'].includes(f) },
  { from: 'hud/radar/mapoverview', to: 'radar', keep: (f) => f === 'icon-death.svg' },
];

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const log = (s) => process.stdout.write(`${s}\n`);
const update = process.argv.includes('--update');

async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

let manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : null;
if (manifest && manifest.commit !== COMMIT && !update) {
  throw new Error(`manifesto e de outro commit (${manifest.commit}); rode com --update`);
}

if (!manifest || update) {

  log(`listando ${REPO}@${COMMIT.slice(0, 7)}`);
  const tree = JSON.parse(
    (await get(`https://api.github.com/repos/${REPO}/git/trees/${COMMIT}?recursive=1`)).toString('utf8'),
  );
  if (tree.truncated) throw new Error('arvore truncada pela API do GitHub');
  const files = {};
  for (const sel of SELECTION) {
    const prefix = `${BASE}/${sel.from}/`;
    for (const e of tree.tree) {
      if (e.type !== 'blob' || !e.path.startsWith(prefix)) continue;
      const name = e.path.slice(prefix.length);
      if (name.includes('/') || !name.endsWith('.svg') || !sel.keep(name)) continue;
      const data = await get(`https://raw.githubusercontent.com/${REPO}/${COMMIT}/${e.path}`);
      const rel = `${sel.to}/${name}`;
      mkdirSync(join(OUT, sel.to), { recursive: true });
      writeFileSync(join(OUT, rel), data);
      files[rel] = sha256(data);
    }
  }
  const license = await get(`https://raw.githubusercontent.com/${REPO}/${COMMIT}/LICENSE`);
  writeFileSync(join(OUT, 'LICENSE'), license);
  manifest = {
    repo: REPO,
    commit: COMMIT,
    license: 'Icones: propriedade da Valve Corporation, uso nao comercial. Ferramentas do repositorio: MIT. Ver LICENSE.',
    licenseSha256: sha256(license),
    files,
  };
  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  log(`manifesto gravado: ${Object.keys(files).length} icones`);
} else {

  let fetched = 0;
  for (const [rel, hash] of Object.entries(manifest.files)) {
    const path = join(OUT, rel);
    if (existsSync(path) && sha256(readFileSync(path)) === hash) continue;
    const folder = SELECTION.find((s) => rel.startsWith(`${s.to}/`));
    const data = await get(`https://raw.githubusercontent.com/${REPO}/${COMMIT}/${BASE}/${folder.from}/${rel.slice(folder.to.length + 1)}`);
    if (sha256(data) !== hash) throw new Error(`hash de ${rel} nao confere. Abortando.`);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, data);
    fetched++;
  }
  const licensePath = join(OUT, 'LICENSE');
  if (!existsSync(licensePath) || sha256(readFileSync(licensePath)) !== manifest.licenseSha256) {
    const license = await get(`https://raw.githubusercontent.com/${REPO}/${COMMIT}/LICENSE`);
    if (sha256(license) !== manifest.licenseSha256) throw new Error('hash do LICENSE nao confere');
    writeFileSync(licensePath, license);
  }
  log(`icones ${REPO}@${COMMIT.slice(0, 7)}: ${Object.keys(manifest.files).length} verificados, ${fetched} baixados`);
}
