import { array_max } from "@/wallet/utils";

export const wrapParams = (params: any[]): Record<number, any> => {
    return params.reduce((acc, v, i) => {
        acc[i] = v;
        return acc;
    }, {});
};

export const unwrapParams = <T>(params: T): T => {
    const keys = Object.keys(params as Record<number, unknown>).map(x => +x);
    if (!keys.length) return [] as T;

    const res = [];
    const max = array_max(keys);
    for (let i = 0; i <= max; i++) {
        res.push((params as Record<number, unknown>)[i]);
    }

    return res as T;
};
