export declare function copyText(text: string, opts?: { clipboard?: { writeText(t: string): Promise<void> }; doc?: Document }): Promise<boolean>
