export type LineKind = 'blank' | 'error' | 'warning' | 'detail' | 'fail' | 'warn-head' | 'pass' | 'summary' | 'section' | 'title' | 'text'
export declare function lineKind(line: string): LineKind
export declare function problemLines(output: string): string[]
export declare function replaySchedule(lines: string[], opts?: { reduced?: boolean; step?: number; max?: number }): { text: string; kind: LineKind; at: number }[]
export declare function mergeLines(a: string[], b: string[]): { text: string; a: boolean; b: boolean }[]
export declare function hangIndent(line: string): number
