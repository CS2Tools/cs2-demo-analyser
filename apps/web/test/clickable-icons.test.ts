import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, '..', 'src');

function arquivosTsx(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...arquivosTsx(full));
    else if (entry.endsWith('.tsx')) out.push(full);
  }
  return out;
}

const BADGES = /<Badge\b[^>]*>([\s\S]*?)<\/Badge>/g;

const ICONE_CLICAVEL = /<[A-Z]\w*\b[^>]*\bonClick=[\s\S]*?\/>/;

describe('icone clicavel dentro de Badge', () => {
  it('o primitivo continua matando o ponteiro dos svg filhos', () => {

    const badge = readFileSync(join(SRC, 'components', 'ui', 'badge.tsx'), 'utf8');
    expect(badge).toContain('[&>svg]:pointer-events-none');
  });

  it('nenhuma tela pendura onClick num icone solto dentro do Badge', () => {
    const culpados: string[] = [];

    for (const file of arquivosTsx(SRC)) {
      const code = readFileSync(file, 'utf8');
      for (const match of code.matchAll(BADGES)) {
        const dentro = match[1]!;

        const semBotoes = dentro.replace(/<button\b[\s\S]*?<\/button>/g, '');
        if (ICONE_CLICAVEL.test(semBotoes)) {
          culpados.push(file.slice(SRC.length + 1).replace(/\\/g, '/'));
        }
      }
    }

    expect(culpados).toEqual([]);
  });
});
