import type { ChannelKey, ChannelMsg, RouteKey, RouteParams, RouteResult } from './routes.js';

export type AssetKind = 'radar' | 'overlay' | 'voice' | 'icon';

export interface Transport {

  call<K extends RouteKey>(route: K, params: RouteParams<K>): Promise<RouteResult<K>>;

  subscribe<C extends ChannelKey>(channel: C, cb: (msg: ChannelMsg<C>) => void): () => void;

  assetUrl(kind: AssetKind, id: string): string;

  saveFile(suggestedName: string, data: Blob): Promise<boolean>;

  readonly kind: 'http' | 'ipc';
}

export class TransportError extends Error {
  constructor(
    readonly route: string,
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'TransportError';
  }
}
