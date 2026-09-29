export type Pm = 'npm' | 'pnpm' | 'bun'
export declare const PMS: { id: Pm; label: string; run: string }[]
export declare const PM_KEY: 'pm'
export declare const PM_EVENT: 'pm-change'
export declare function commandFor(pm: string, pkg: string, args?: string): string
