export function wrapBigInts(data: any): any {
    if (Array.isArray(data)) {
        return data.map(wrapBigInts);
    }
    if (typeof data === "object") {
        return Object.fromEntries(Object.entries(data).map(([k, v]) => [k, wrapBigInts(v)]));
    }
    if (typeof data === "bigint") {
        return data.toString();
    }
    return data;
}