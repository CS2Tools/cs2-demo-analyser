import {
  TransportError,
  type AssetKind,
  type ChannelKey,
  type ChannelMsg,
  type RouteKey,
  type RouteParams,
  type RouteResult,
  type Transport,
} from '@cs2/contract';

interface ElectronBridge {
  rpc(route: string, params: unknown): Promise<unknown>;
  on(channel: string, cb: (msg: unknown) => void): () => void;
  assetUrl(kind: string, id: string): string;
  saveFile(suggestedName: string, data: ArrayBuffer): Promise<boolean>;
}

declare global {
  interface Window {
    __cs2Bridge?: ElectronBridge;
  }
}

export class HttpTransport implements Transport {
  readonly kind = 'http' as const;

  #source: EventSource | null = null;
  #subs = new Map<string, Set<(msg: unknown) => void>>();

  async call<K extends RouteKey>(route: K, params: RouteParams<K>): Promise<RouteResult<K>> {
    let response: Response;
    try {
      response = await fetch(`/api/${route}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params ?? {}),
      });
    } catch (cause) {
      throw new TransportError(route, 'o host local nao respondeu', cause);
    }

    const payload = (await response.json().catch(() => null)) as
      | { ok: true; result: unknown }
      | { ok: false; error: string }
      | null;

    if (!response.ok || !payload || payload.ok !== true) {
      const message = payload && 'error' in payload ? payload.error : `HTTP ${response.status}`;
      throw new TransportError(route, message);
    }
    return payload.result as RouteResult<K>;
  }

  subscribe<C extends ChannelKey>(channel: C, cb: (msg: ChannelMsg<C>) => void): () => void {
    this.#ensureSource();
    let set = this.#subs.get(channel);
    if (!set) {
      set = new Set();
      this.#subs.set(channel, set);
      this.#source?.addEventListener(channel, (ev) => {
        const data: unknown = JSON.parse((ev as MessageEvent<string>).data);
        for (const fn of this.#subs.get(channel) ?? []) fn(data);
      });
    }
    const wrapped = cb as (msg: unknown) => void;
    set.add(wrapped);
    return () => {
      set.delete(wrapped);
    };
  }

  assetUrl(kind: AssetKind, id: string): string {

    return `/assets/${kind === 'overlay' ? 'radar' : kind}/${id}`;
  }

  async saveFile(suggestedName: string, data: Blob): Promise<boolean> {

    const url = URL.createObjectURL(data);
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = suggestedName;
      document.body.append(a);
      a.click();
      a.remove();
      return true;
    } finally {

      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    }
  }

  #ensureSource(): void {
    this.#source ??= new EventSource('/api/events');
  }
}

export class IpcTransport implements Transport {
  readonly kind = 'ipc' as const;

  constructor(private readonly bridge: ElectronBridge) {}

  async call<K extends RouteKey>(route: K, params: RouteParams<K>): Promise<RouteResult<K>> {
    try {
      return (await this.bridge.rpc(route, params ?? {})) as RouteResult<K>;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      throw new TransportError(route, message, cause);
    }
  }

  subscribe<C extends ChannelKey>(channel: C, cb: (msg: ChannelMsg<C>) => void): () => void {
    return this.bridge.on(channel, cb as (msg: unknown) => void);
  }

  assetUrl(kind: AssetKind, id: string): string {
    return this.bridge.assetUrl(kind, id);
  }

  async saveFile(suggestedName: string, data: Blob): Promise<boolean> {
    return this.bridge.saveFile(suggestedName, await data.arrayBuffer());
  }
}

export function createTransport(): Transport {
  const bridge = globalThis.window?.__cs2Bridge;
  return bridge ? new IpcTransport(bridge) : new HttpTransport();
}

export const transport: Transport = createTransport();
