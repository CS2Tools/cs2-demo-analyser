export interface PropSet {

  required: readonly string[];

  optional: readonly string[];
}

export interface ResilientParse<Row> {
  rows: Row[];

  dropped: string[];
}

type ParseFn<Row> = (props: string[]) => Row[];

function present(rows: Record<string, unknown>[], prop: string): boolean {

  for (const row of rows) if (prop in row) return true;
  return rows.length === 0;
}

export function parseResilient<Row extends Record<string, unknown>>(
  parse: ParseFn<Row>,
  props: PropSet,
): ResilientParse<Row> {
  const all = [...props.required, ...props.optional];
  try {
    const rows = parse(all);
    const dropped = props.optional.filter((p) => !present(rows, p));
    return { rows, dropped };
  } catch (firstError) {

    const broken: string[] = [];
    for (const prop of props.optional) {
      try {
        parse([...props.required, prop]);
      } catch {
        broken.push(prop);
      }
    }

    const kept = props.optional.filter((p) => !broken.includes(p));
    try {
      const rows = parse([...props.required, ...kept]);
      return {
        rows,
        dropped: [...broken, ...props.optional.filter((p) => !present(rows, p) && !broken.includes(p))],
      };
    } catch (secondError) {
      throw new Error(
        'A demo nao entregou propriedades que a importacao precisa: ' +
          `${props.required.join(', ')}. Isso costuma acontecer depois de uma ` +
          'atualizacao do CS2 mudar os nomes dos campos. ' +
          `Detalhe do parser: ${message(secondError) || message(firstError)}`,
        { cause: secondError },
      );
    }
  }
}

const message = (err: unknown): string => (err instanceof Error ? err.message : String(err));
