import { afterEach, describe, expect, it, vi } from 'vitest';
import { canPickFiles, readDroppedDemos } from '../src/lib/demo-files';

const asWindow = globalThis as { window?: Record<string, unknown> };

function withBridge(bridge: unknown): void {
  asWindow.window = { __cs2Bridge: bridge } as Record<string, unknown>;
}

afterEach(() => {
  delete asWindow.window;
});

const file = (name: string, path?: string): File => {
  const f = new File([''], name);
  if (path) Object.defineProperty(f, 'path', { value: path });
  return f;
};

describe('arquivos arrastados', () => {
  it('no app, o caminho vem do preload (File.path nao existe mais no Electron 32+)', () => {
    const pathForFile = vi.fn((f: File) => `C:\\demos\\${f.name}`);
    withBridge({ pathForFile, pickDemos: async () => [] });

    const out = readDroppedDemos([file('a.dem'), file('b.dem')]);
    expect(out.paths).toEqual(['C:\\demos\\a.dem', 'C:\\demos\\b.dem']);
    expect(out.withoutPath).toEqual([]);
    expect(pathForFile).toHaveBeenCalledTimes(2);
  });

  it('cai para File.path em Electron antigo', () => {
    withBridge({});
    const out = readDroppedDemos([file('a.dem', 'D:\\velho\\a.dem')]);
    expect(out.paths).toEqual(['D:\\velho\\a.dem']);
  });

  it('no navegador, sem caminho: a tela pede para colar em vez de falhar calada', () => {
    const out = readDroppedDemos([file('a.dem')]);
    expect(out.paths).toEqual([]);
    expect(out.withoutPath).toEqual(['a.dem']);
  });

  it('separa o que nao e .dem', () => {
    withBridge({ pathForFile: (f: File) => `C:\\${f.name}` });
    const out = readDroppedDemos([file('a.dem'), file('foto.png'), file('B.DEM')]);
    expect(out.paths).toEqual(['C:\\a.dem', 'C:\\B.DEM']);
    expect(out.ignored).toEqual(['foto.png']);
  });

  it('o seletor nativo so aparece quando existe de verdade', () => {
    expect(canPickFiles()).toBe(false);
    withBridge({ pickDemos: async () => [] });
    expect(canPickFiles()).toBe(true);
  });
});
