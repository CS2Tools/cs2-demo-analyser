export class TickClock {
  readonly tickRate: number;

  constructor(tickRate: number) {
    if (!Number.isFinite(tickRate) || tickRate <= 0) {
      throw new RangeError(`tickRate invalido: ${tickRate}`);
    }
    this.tickRate = tickRate;
  }

  toSeconds(ticks: number): number {
    return ticks / this.tickRate;
  }

  toMs(ticks: number): number {
    return (ticks * 1000) / this.tickRate;
  }

  toTicks(seconds: number): number {
    return Math.round(seconds * this.tickRate);
  }

  toTicksCeil(seconds: number): number {
    return Math.ceil(seconds * this.tickRate);
  }

  durationSeconds(fromTick: number, toTick: number): number {
    return (toTick - fromTick) / this.tickRate;
  }

  strideForHz(targetHz: number): number {
    if (!Number.isFinite(targetHz) || targetHz <= 0) {
      throw new RangeError(`targetHz invalido: ${targetHz}`);
    }
    return Math.max(1, Math.round(this.tickRate / targetHz));
  }

  formatClock(ticks: number): string {
    const total = Math.max(0, Math.floor(this.toSeconds(ticks)));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }
}
