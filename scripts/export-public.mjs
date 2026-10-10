import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEST = resolve(process.argv[2] ?? join(ROOT, '..', 'cs2-demo-analyser-public'));

if (DEST === ROOT) {
  console.error('O destino nao pode ser o proprio repositorio.');
  process.exit(1);
}

const CODIGO_TS = new Set(['.ts', '.tsx', '.mts', '.cts', '.mjs', '.cjs', '.js', '.jsx']);

function tirarComentarios(fonte, arquivo) {
  const sf = ts.createSourceFile(
    arquivo,
    fonte,
    ts.ScriptTarget.Latest,
     true,
    arquivo.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const faixas = [];
  const vistas = new Set();
  const marcar = (pos, end) => {
    const chave = `${pos}:${end}`;
    if (vistas.has(chave)) return;
    vistas.add(chave);
    faixas.push([pos, end]);
  };

  const visitar = (no) => {
    for (const r of ts.getLeadingCommentRanges(fonte, no.getFullStart()) ?? []) {
      marcar(r.pos, r.end);
    }
    for (const r of ts.getTrailingCommentRanges(fonte, no.getEnd()) ?? []) {
      marcar(r.pos, r.end);
    }

    if (ts.isJsxExpression(no) && no.expression === undefined) {
      marcar(no.getStart(sf), no.getEnd());
      return;
    }
    for (const filho of no.getChildren(sf)) visitar(filho);
  };
  visitar(sf);

  faixas.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let saida = '';
  let cursor = 0;
  for (const [pos, end] of faixas) {
    if (pos < cursor) continue;
    saida += fonte.slice(cursor, pos);
    cursor = end;
  }
  saida += fonte.slice(cursor);
  return limparLinhasVazias(saida);
}

function tirarComentariosSql(fonte) {
  let saida = '';
  let emString = false;
  for (let i = 0; i < fonte.length; i += 1) {
    const c = fonte[i];
    if (emString) {
      saida += c;
      if (c === "'") emString = fonte[i + 1] === "'" ? (saida += fonte[++i], true) : false;
      continue;
    }
    if (c === "'") {
      emString = true;
      saida += c;
      continue;
    }
    if (c === '/' && fonte[i + 1] === '*') {
      i += 2;
      while (i < fonte.length && !(fonte[i] === '*' && fonte[i + 1] === '/')) i += 1;
      i += 1;
      continue;
    }
    if (c === '-' && fonte[i + 1] === '-') {
      while (i < fonte.length && fonte[i] !== '\n') i += 1;
      saida += '\n';
      continue;
    }
    saida += c;
  }
  return limparLinhasVazias(saida);
}

function limparLinhasVazias(texto) {
  return `${texto
    .split('\n')
    .map((l) => (l.trim() === '' ? '' : l.replace(/\s+$/, '')))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+/, '')
    .trimEnd()}\n`;
}

const versionados = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);

rmSync(DEST, { recursive: true, force: true });
mkdirSync(DEST, { recursive: true });

let processados = 0;
let copiados = 0;
for (const rel of versionados) {
  const origem = join(ROOT, rel);
  if (!existsSync(origem)) continue;
  const destino = join(DEST, rel);
  mkdirSync(dirname(destino), { recursive: true });

  const ponto = rel.lastIndexOf('.');
  const ext = ponto < 0 ? '' : rel.slice(ponto);

  if (CODIGO_TS.has(ext)) {
    writeFileSync(destino, tirarComentarios(readFileSync(origem, 'utf8'), rel), 'utf8');
    processados += 1;
  } else if (ext === '.sql') {
    writeFileSync(destino, tirarComentariosSql(readFileSync(origem, 'utf8')), 'utf8');
    processados += 1;
  } else {
    cpSync(origem, destino);
    copiados += 1;
  }
}

for (const sobra of ['.claude', '.agents']) {
  rmSync(join(DEST, sobra), { recursive: true, force: true });
}

console.log(`\n  ${processados} arquivos sem comentarios, ${copiados} copiados`);
console.log(`  destino: ${DEST}\n`);

console.log('  conferindo a copia com tsc...');
const instalar = spawnSync('npm', ['install', '--no-audit', '--no-fund', '--silent'], {
  cwd: DEST,
  stdio: 'inherit',
  shell: true,
});
if (instalar.status !== 0) {
  console.error('\n  npm install falhou na copia.');
  process.exit(1);
}
const check = spawnSync('npm', ['run', 'typecheck'], { cwd: DEST, stdio: 'inherit', shell: true });
if (check.status !== 0) {
  console.error('\n  A COPIA NAO COMPILA. Nao publique.');
  process.exit(1);
}
const testes = spawnSync('npm', ['test'], { cwd: DEST, stdio: 'inherit', shell: true });
if (testes.status !== 0) {
  console.error('\n  OS TESTES FALHAM NA COPIA. Nao publique.');
  process.exit(1);
}

const versao = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;

console.log(`
  Copia publica pronta e conferida: typecheck e testes passam.

  Para publicar, no destino (a primeira vez tem o \`git init -b main\` e o
  \`git remote add\`; depois disso, so os tres do meio):
    git init -b main
    git remote add origin <url do repositorio na OUTRA conta>
    git add -A
    git commit -m "CS2 Demo Analyser ${versao}"
    git push -u origin main
`);
