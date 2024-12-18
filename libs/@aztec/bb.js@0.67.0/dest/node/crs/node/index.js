import { NetCrs, NetGrumpkinCrs } from '../net_crs.js';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { stat } from 'fs/promises';
import createDebug from 'debug';
import { homedir } from 'os';
const debug = createDebug('bb.js:crs');
/**
 * Generic CRS finder utility class.
 */
export class Crs {
    constructor(numPoints, path) {
        this.numPoints = numPoints;
        this.path = path;
    }
    static async new(numPoints, crsPath = homedir() + '/.bb-crs') {
        const crs = new Crs(numPoints, crsPath);
        await crs.init();
        return crs;
    }
    async init() {
        mkdirSync(this.path, { recursive: true });
        const g1FileSize = await stat(this.path + '/bn254_g1.dat')
            .then(stats => stats.size)
            .catch(() => 0);
        const g2FileSize = await stat(this.path + '/bn254_g2.dat')
            .then(stats => stats.size)
            .catch(() => 0);
        if (g1FileSize >= this.numPoints * 64 && g1FileSize % 64 == 0 && g2FileSize == 128) {
            debug(`using cached crs of size: ${g1FileSize / 64}`);
            return;
        }
        debug(`downloading crs of size: ${this.numPoints}`);
        const crs = new NetCrs(this.numPoints);
        await crs.init();
        writeFileSync(this.path + '/bn254_g1.dat', crs.getG1Data());
        writeFileSync(this.path + '/bn254_g2.dat', crs.getG2Data());
    }
    /**
     * G1 points data for prover key.
     * @returns The points data.
     */
    getG1Data() {
        return readFileSync(this.path + '/bn254_g1.dat');
    }
    /**
     * G2 points data for verification key.
     * @returns The points data.
     */
    getG2Data() {
        return readFileSync(this.path + '/bn254_g2.dat');
    }
}
/**
 * Generic Grumpkin CRS finder utility class.
 */
export class GrumpkinCrs {
    constructor(numPoints, path) {
        this.numPoints = numPoints;
        this.path = path;
    }
    static async new(numPoints, crsPath = homedir() + '/.bb-crs') {
        const crs = new GrumpkinCrs(numPoints, crsPath);
        await crs.init();
        return crs;
    }
    async init() {
        mkdirSync(this.path, { recursive: true });
        const g1FileSize = await stat(this.path + '/grumpkin_g1.dat')
            .then(stats => stats.size)
            .catch(() => 0);
        if (g1FileSize >= this.numPoints * 64 && g1FileSize % 64 == 0) {
            debug(`using cached crs of size: ${g1FileSize / 64}`);
            return;
        }
        debug(`downloading crs of size: ${this.numPoints}`);
        const crs = new NetGrumpkinCrs(this.numPoints);
        await crs.init();
        writeFileSync(this.path + '/grumpkin_g1.dat', crs.getG1Data());
    }
    /**
     * G1 points data for prover key.
     * @returns The points data.
     */
    getG1Data() {
        return readFileSync(this.path + '/grumpkin_g1.dat');
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvY3JzL25vZGUvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLE1BQU0sRUFBRSxjQUFjLEVBQUUsTUFBTSxlQUFlLENBQUM7QUFDdkQsT0FBTyxFQUFFLFNBQVMsRUFBRSxZQUFZLEVBQUUsYUFBYSxFQUFFLE1BQU0sSUFBSSxDQUFDO0FBQzVELE9BQU8sRUFBRSxJQUFJLEVBQUUsTUFBTSxhQUFhLENBQUM7QUFDbkMsT0FBTyxXQUFXLE1BQU0sT0FBTyxDQUFDO0FBQ2hDLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxJQUFJLENBQUM7QUFFN0IsTUFBTSxLQUFLLEdBQUcsV0FBVyxDQUFDLFdBQVcsQ0FBQyxDQUFDO0FBRXZDOztHQUVHO0FBQ0gsTUFBTSxPQUFPLEdBQUc7SUFDZCxZQUE0QixTQUFpQixFQUFrQixJQUFZO1FBQS9DLGNBQVMsR0FBVCxTQUFTLENBQVE7UUFBa0IsU0FBSSxHQUFKLElBQUksQ0FBUTtJQUFHLENBQUM7SUFFL0UsTUFBTSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsU0FBaUIsRUFBRSxPQUFPLEdBQUcsT0FBTyxFQUFFLEdBQUcsVUFBVTtRQUNsRSxNQUFNLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxTQUFTLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDeEMsTUFBTSxHQUFHLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDakIsT0FBTyxHQUFHLENBQUM7SUFDYixDQUFDO0lBRUQsS0FBSyxDQUFDLElBQUk7UUFDUixTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBRTFDLE1BQU0sVUFBVSxHQUFHLE1BQU0sSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLEdBQUcsZUFBZSxDQUFDO2FBQ3ZELElBQUksQ0FBQyxLQUFLLENBQUMsRUFB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