const cbNamesMap = {
    log: "onlog",
    info: "onlog",
    warn: "onwarn",
    error: "onerror",
    debug: "ondebug",
    trace: "ondebug",
} as const;

for (const method of Object.keys(cbNamesMap) as (keyof typeof cbNamesMap)[]) {
    const original = console[method].bind(console);
    const cbName = cbNamesMap[method];

    console[method] = (...args: any[]) => {
        const cb = (window as any)[cbName];
        if (typeof cb === "function") {
            try {
                cb(...args);
            } catch (err) {
                original(`Error in window.${cbName}:`, err);
            }
        }

        original(...args);
    };
}
