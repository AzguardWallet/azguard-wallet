const levels = ['log', 'warn', 'error', 'debug'] as const;

for (const method of levels) {
    const original = console[method].bind(console);

    console[method] = (...args: any[]) => {
        const cbName = 'on' + method.charAt(0).toUpperCase() + method.slice(1);

        const cb = (window as any)[cbName];
        if (typeof cb === 'function') {
            try {
                cb(...args);
            } catch (err) {
                original(`Error in window.${cbName}:`, err);
            }
        }

        original(...args);
    };
}
