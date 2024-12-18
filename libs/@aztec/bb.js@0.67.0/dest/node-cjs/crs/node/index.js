"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GrumpkinCrs = exports.Crs = void 0;
const tslib_1 = require("tslib");
const net_crs_js_1 = require("../net_crs.js");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const debug_1 = tslib_1.__importDefault(require("debug"));
const os_1 = require("os");
const debug = (0, debug_1.default)('bb.js:crs');
/**
 * Generic CRS finder utility class.
 */
class Crs {
    constructor(numPoints, path) {
        this.numPoints = numPoints;
        this.path = path;
    }
    static async new(numPoints, crsPath = (0, os_1.homedir)() + '/.bb-crs') {
        const crs = new Crs(numPoints, crsPath);
        await crs.init();
        return crs;
    }
    async init() {
        (0, fs_1.mkdirSync)(this.path, { recursive: true });
        const g1FileSize = await (0, promises_1.stat)(this.path + '/bn254_g1.dat')
            .then(stats => stats.size)
            .catch(() => 0);
        const g2FileSize = await (0, promises_1.stat)(this.path + '/bn254_g2.dat')
            .then(stats => stats.size)
            .catch(() => 0);
        if (g1FileSize >= this.numPoints * 64 && g1FileSize % 64 == 0 && g2FileSize == 128) {
            debug(`using cached crs of size: ${g1FileSize / 64}`);
            return;
        }
        debug(`downloading crs of size: ${this.numPoints}`);
        const crs = new net_crs_js_1.NetCrs(this.numPoints);
        await crs.init();
        (0, fs_1.writeFileSync)(this.path + '/bn254_g1.dat', crs.getG1Data());
        (0, fs_1.writeFileSync)(this.path + '/bn254_g2.dat', crs.getG2Data());
    }
    /**
     * G1 points data for prover key.
     * @returns The points data.
     */
    getG1Data() {
        return (0, fs_1.readFileSync)(this.path + '/bn254_g1.dat');
    }
    /**
     * G2 points data for verification key.
     * @returns The points data.
     */
    getG2Data() {
        return (0, fs_1.readFileSync)(this.path + '/bn254_g2.dat');
    }
}
exports.Crs = Crs;
/**
 * Generic Grumpkin CRS finder utility class.
 */
class GrumpkinCrs {
    constructor(numPoints, path) {
        this.numPoints = numPoints;
        this.path = path;
    }
    static async new(numPoints, crsPath = (0, os_1.homedir)() + '/.bb-crs') {
        const crs = new GrumpkinCrs(numPoints, crsPath);
        await crs.init();
        return crs;
    }
    async init() {
        (0, fs_1.mkdirSync)(this.path, { recursive: true });
        const g1FileSize = await (0, promises_1.stat)(this.path + '/grumpkin_g1.dat')
            .then(stats => stats.size)
            .catch(() => 0);
        if (g1FileSize >= this.numPoints * 64 && g1FileSize % 64 == 0) {
            debug(`using cached crs of size: ${g1FileSize / 64}`);
            return;
        }
        debug(`downloading crs of size: ${this.numPoints}`);
        const crs = new net_crs_js_1.NetGrumpkinCrs(this.numPoints);
        await crs.init();
        (0, fs_1.writeFileSync)(this.path + '/grumpkin_g1.dat', crs.getG1Data());
    }
    /**
     * G1 points data for prover key.
     * @returns The points data.
     */
    getG1Data() {
        return (0, fs_1.readFileSync)(this.path + '/grumpkin_g1.dat');
    }
}
exports.GrumpkinCrs = GrumpkinCrs;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvY3JzL25vZGUvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7OztBQUFBLDhDQUF1RDtBQUN2RCwyQkFBNEQ7QUFDNUQsMENBQW1DO0FBQ25DLDBEQUFnQztBQUNoQywyQkFBNkI7QUFFN0IsTUFBTSxLQUFLLEdBQUcsSUFBQSxlQUFXLEVBQUMsV0FBVyxDQUFDLENBQUM7QUFFdkM7O0dBRUc7QUFDSCxNQUFhLEdBQUc7SUFDZCxZQUE0QixTQUFpQixFQUFrQixJQUFZO1FBQS9DLGNBQVMsR0FBVCxTQUFTLENBQVE7UUFBa0IsU0FBSSxHQUFKLElBQUksQ0FBUTtJQUFHLENBQUM7SUFFL0UsTUFBTSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsU0FBaUIsRUFBRSxPQUFPLEdBQUcsSUFBQSxZQUFPLEdBQUUsR0FBRyxVQUFVO1FBQ2xFLE1BQU0sR0FBRyxHQUFHLElBQUksR0FBRyxDQUFDLFNBQVMsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUN4QyxNQUFNLEdBQUcsQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUNqQixPQUFPLEdBQUcsQ0FBQztJQUNiLENBQUM7SUFFRCxLQUFLLENBQUMsSUFBSTtRQUNSLElBQUEsY0FBUyxFQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztRQUUxQyxNQUFNLFVBQVUsR0FBRyxNQUFNLElBQUEsZUFBSSxFQUFDLElBQUksQ0FBQyxJQUFJLEdBQUcsZUFBZSxDQUFDO2FBQ3ZELElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUM7YUFDekIsS0FBSyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ2xCLE1BQU0sVUFBVSxHQUFHLE1BQU0sSUFBQSxlQUFJLEVBQUMsSUFBSSxDQUFDLElBQUksR0FBRyxlQUFlLENB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