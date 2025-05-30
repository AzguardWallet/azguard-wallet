export const array_equals = (arr1: Uint8Array, arr2: Uint8Array): boolean => {
    if (arr1.length !== arr2.length) {
        return false;
    }
    for (let i = 0; i < arr1.length; i++) {
        if (arr1[i] !== arr2[i]) {
            return false;
        }
    }
    return true;
}

export const array_max = (arr: Array<number>): number => {
    let res = 0;
    for (const x of arr) {
        if (x > res) {
            res = x;
        }
    }
    return res;
}