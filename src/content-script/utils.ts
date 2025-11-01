export function inject(prop: string, value: any) {
    try {
        delete (window as any)[prop];
    } catch {}
    try {
        Object.defineProperty(window, prop, { value, writable: false });
    } catch {}
    try {
        (window as any)[prop] = value;
    } catch {}
}
