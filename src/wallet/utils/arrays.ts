export const array_equals = (arr1: Uint8Array<ArrayBuffer>, arr2: Uint8Array<ArrayBuffer>): boolean => {
    if (arr1.length !== arr2.length) {
        return false;
    }
    for (let i = 0; i < arr1.length; i++) {
        if (arr1[i] !== arr2[i]) {
            return false;
        }
    }
    return true;
};

export const array_max = (arr: Array<number>): number => {
    let res = 0;
    for (const x of arr) {
        if (x > res) {
            res = x;
        }
    }
    return res;
};

export function hasIntersectionByKeys<T extends Record<string, any>>(
    arr1: T[],
    arr2: T[],
    keys: (keyof T)[]
): boolean {
    const keySet = new Set<string>();
    
    arr1.forEach(item => {
        const key = keys.map(k => item[k]).join('|');
        keySet.add(key);
    });
    
    return arr2.some(item => {
        const key = keys.map(k => item[k]).join('|');
        return keySet.has(key);
    });
}
