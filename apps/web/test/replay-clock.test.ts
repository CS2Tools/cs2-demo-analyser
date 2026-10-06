import { describe, expect, it } from 'vitest';
import { currentFrame } from '../src/components/replay/use-replay-clock';

describe('currentFrame — de onde reancorar ao trocar a velocidade', () => {
  const hz = 8;

  it('tocando, e a ancora mais o tempo decorrido: NAO a ancora sozinha', () => {

    expect(currentFrame(0, 1000, true, hz, 1, 600, 3000)).toBe(16);
  });

  it('respeita a velocidade vigente no trecho ja decorrido', () => {
    expect(currentFrame(10, 0, true, hz, 2, 600, 1000)).toBe(26);
  });

  it('pausado, a ancora e o quadro atual', () => {
    expect(currentFrame(42, 0, false, hz, 1, 600, 99_999)).toBe(42);
  });

  it('nunca passa do ultimo quadro', () => {
    expect(currentFrame(590, 0, true, hz, 8, 600, 10_000)).toBe(599);
  });
});
