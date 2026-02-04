// Type declaration for sql.js
declare module 'sql.js' {
  export interface SqlJsStatic {
    Database: typeof Database
  }

  export interface QueryExecResult {
    columns: string[]
    values: unknown[][]
  }

  export type SqlValue = string | number | Uint8Array | null | undefined
  export type SqlParams = SqlValue[] | Record<string, SqlValue> | unknown[]

  export interface Statement {
    bind(params?: SqlParams): boolean
    step(): boolean
    getAsObject(params?: SqlParams): Record<string, unknown>
    get(params?: SqlParams): unknown[]
    reset(): void
    free(): boolean
    run(params?: SqlParams): void
  }

  export class Database {
    constructor(data?: ArrayLike<number> | Buffer | null)
    run(sql: string, params?: SqlParams): Database
    exec(sql: string, params?: SqlParams): QueryExecResult[]
    prepare(sql: string): Statement
    export(): Uint8Array
    close(): void
    getRowsModified(): number
  }

  export interface SqlJsConfig {
    locateFile?: (filename: string) => string
  }

  export default function initSqlJs(config?: SqlJsConfig): Promise<SqlJsStatic>
}
