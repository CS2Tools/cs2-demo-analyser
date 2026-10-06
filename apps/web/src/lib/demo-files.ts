interface FileBridge {
  pathForFile?: (file: File) => string | null;
  pickDemos?: () => Promise<string[]>;
}

const bridge = (): FileBridge | undefined =>
  (globalThis as { window?: { __cs2Bridge?: FileBridge } }).window?.__cs2Bridge;

export const canPickFiles = (): boolean => typeof bridge()?.pickDemos === 'function';

export async function pickDemoFiles(): Promise<string[]> {
  const pick = bridge()?.pickDemos;
  if (!pick) return [];
  return (await pick()) ?? [];
}

export function pathOfDroppedFile(file: File): string | null {
  const viaBridge = bridge()?.pathForFile?.(file) ?? null;
  if (viaBridge) return viaBridge;

  const legacy = (file as File & { path?: string }).path;
  return legacy && legacy !== file.name ? legacy : null;
}

export interface DroppedDemos {

  paths: string[];

  ignored: string[];

  withoutPath: string[];
}

export function readDroppedDemos(files: FileList | File[]): DroppedDemos {
  const out: DroppedDemos = { paths: [], ignored: [], withoutPath: [] };
  for (const file of Array.from(files)) {
    if (!file.name.toLowerCase().endsWith('.dem')) {
      out.ignored.push(file.name);
      continue;
    }
    const path = pathOfDroppedFile(file);
    if (path) out.paths.push(path);
    else out.withoutPath.push(file.name);
  }
  return out;
}
