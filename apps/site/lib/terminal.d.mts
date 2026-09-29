export type LineKind = 'blank' | 'error' | 'warning' | 'detail' | 'fail' | 'warn-head' | 'pass' | 'summary' | 'section' | 'title' | 'text'
export declare function lineKind(line: string): LineKind
export declare function problemLines(output: string): string[]
export declare function replaySchedule(lines: string[], opts?: { reduced?: boolean; step?: number; max?: number }): { text: string; kind: LineKind; at: number }[]
