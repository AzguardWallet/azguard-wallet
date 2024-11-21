import { Fr } from "@aztec/aztec.js";
import { NestedProcessReturnValues } from "@aztec/circuit-types";

export function extractReturnValues(values: NestedProcessReturnValues[]): Fr[] {
    const res = [];
    for (const v of values) {
        for (const value of v.values ?? []) {
            res.push(value);
        }
        res.push(...extractReturnValues(v.nested));
    }
    return res;
}