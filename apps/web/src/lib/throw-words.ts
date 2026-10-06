import { describeThrow } from '@cs2/core';

export function throwWords(point: {
  crouched: boolean | null;
  onGround: boolean | null;
  speed: number | null;
  throwStrength: number | null;
}): { movement: string; click: string; crouched: boolean; short: string } {
  const d = describeThrow(point);

  const movement =
    d.movement === 'desconhecido' ? 'movimento não registrado' : d.movement;

  const click =
    d.click === null
      ? 'botão não registrado'
      : d.click === 'esquerdo'
        ? 'clique esquerdo (longo)'
        : d.click === 'direito'
          ? 'clique direito (curto)'
          : 'os dois botões (médio)';

  const short = [
    d.movement === 'desconhecido' ? null : d.movement,
    d.crouched === true ? 'agachado' : null,
    d.click,
  ]
    .filter(Boolean)
    .join(' · ');

  return { movement, click, crouched: d.crouched === true, short };
}
