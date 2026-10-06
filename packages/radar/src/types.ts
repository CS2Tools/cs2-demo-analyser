export interface MapSplit {

  bounds: { top: number; bottom: number };

  offset: { x: number; y: number };

  zRange?: { min: number; max: number };
  survivableDistance?: number[];
}

export interface MapMeta {

  name: string;
  version: { radar: number; format: number };

  resolution: number;

  offset: { x: number; y: number };
  splits: MapSplit[];
  zRange?: { min: number; max: number };
  advisoryPosition?: { x: number; y: number };
  survivableDistance?: number[];
}

export interface RadarPosition {

  px: number;

  py: number;

  split: number;
}
