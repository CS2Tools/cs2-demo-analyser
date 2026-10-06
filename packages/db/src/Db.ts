export type SqlValue = string | number | bigint | boolean | null | Date;

export interface QueryResult {
  columns: { name: string; type: string }[];
  rows: unknown[][];
  rowCount: number;

  elapsedMs: number;

  truncated: boolean;
}

export interface Appender {
  appendVarchar(value: string): void;
  appendInteger(value: number): void;
  appendBigInt(value: bigint): void;
  appendTinyInt(value: number): void;
  appendSmallInt(value: number): void;
  appendFloat(value: number): void;
  appendDouble(value: number): void;
  appendBoolean(value: boolean): void;
  appendNull(): void;
  endRow(): void;
  flushSync(): void;
  closeSync(): void;
}

export interface Db {

  query<T = Record<string, unknown>>(sql: string, params?: SqlValue[]): Promise<T[]>;

  queryOne<T = Record<string, unknown>>(sql: string, params?: SqlValue[]): Promise<T | null>;

  exec(sql: string, params?: SqlValue[]): Promise<void>;

  rawConsoleQuery(sql: string, maxRows: number): Promise<QueryResult>;

  bulkInsert(table: string, columns: string[], rows: SqlValue[][]): Promise<number>;

  appender(table: string): Promise<Appender>;

  attachAndMerge(
    stagingPath: string,
    tables: string[],
    beforeInsert?: (tx: Db) => Promise<void>,
  ): Promise<void>;

  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;

  listTables(): Promise<string[]>;

  checkpoint(): Promise<void>;

  close(): Promise<void>;
}
