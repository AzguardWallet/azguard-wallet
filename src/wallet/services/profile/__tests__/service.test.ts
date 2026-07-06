import { beforeEach, describe, expect, test, vi } from "vitest";
import { IService, ServiceCollection } from "@/wallet/base";
import { IConfig } from "@/wallet/config";
import { DummyLogger } from "@/wallet/logger";
import { PasskeyService } from "@/wallet/services/passkey/service";
import { EventHandler } from "@/wallet/utils/event-handler";
import { ProfileInfo, ProfileOrigin, ProfileService, SENTINEL_STORAGE_KEY, UNKNOWN_ORIGIN } from "../service";

const BUILD_ORIGIN: ProfileOrigin = { sentinel: "9-test", walletVersion: "0.14.0-test", aztecVersion: "5.0.0-test" };
const PROFILES_ROOT = "azguard:core:profiles";
const MASTER_KEY = Buffer.from(new Uint8Array(32).fill(7)).toString("base64");

beforeEach(() => {
    // Build-time defines are absent under vitest; stub them as globals (resolved via global scope).
    vi.stubGlobal("__SENTINEL__", BUILD_ORIGIN.sentinel);
    vi.stubGlobal("__VERSION__", BUILD_ORIGIN.walletVersion);
    vi.stubGlobal("__AZTEC_VERSION__", BUILD_ORIGIN.aztecVersion);
});

const seedProfile = (profile: { id: string; [key: string]: unknown }) =>
    chrome.storage.local.set({ [`${PROFILES_ROOT}@${profile.id}`]: JSON.stringify(profile) });

const createService = async () => {
    const config: IConfig = {
        onUpdate: new EventHandler(),
        // Only "sessionTtl" is ever read; 0 = sessions never expire. The cast is for the generic signature.
        get: (() => 0) as IConfig["get"],
    };
    const passkeyServiceMock: IService = {
        name: PasskeyService.name,
        start: async () => {},
    };

    const profileService = new ProfileService(config, new DummyLogger());

    const services = new ServiceCollection();
    services.add(passkeyServiceMock);
    services.add(profileService);
    await services.start();

    return profileService;
};

describe("origin backfill on startup", () => {
    const legacyProfile = { id: "p1", name: "Legacy", type: "password", guard: "g", secret: "s" };

    test("stamps the stored global sentinel on profiles without origin", async () => {
        await seedProfile(legacyProfile);
        await chrome.storage.local.set({ [SENTINEL_STORAGE_KEY]: "8" });

        const service = await createService();

        const [profile] = await service.getProfiles();
        expect(profile.origin).toEqual({ ...UNKNOWN_ORIGIN, sentinel: "8" });
    });

    test("stamps \"unknown\" when no global sentinel is stored", async () => {
        await seedProfile(legacyProfile);

        const service = await createService();

        const [profile] = await service.getProfiles();
        expect(profile.origin).toEqual(UNKNOWN_ORIGIN);
    });

    test("never overwrites an existing origin", async () => {
        const origin: ProfileOrigin = { sentinel: "7", walletVersion: "0.9.0", aztecVersion: "3.0.0" };
        await seedProfile({ ...legacyProfile, origin });
        await chrome.storage.local.set({ [SENTINEL_STORAGE_KEY]: "8" });

        const service = await createService();

        const [profile] = await service.getProfiles();
        expect(profile.origin).toEqual(origin);
    });
});

describe("origin stamping at creation", () => {
    test("createProfile stamps the current build versions", async () => {
        const service = await createService();

        const profile = await service.createProfile("New", "password123");

        expect(profile.origin).toEqual(BUILD_ORIGIN);
    });

    test("importPlain stamps the current build versions", async () => {
        const service = await createService();

        const profile = await service.importPlain("Imported", MASTER_KEY, "password123");

        expect(profile.origin).toEqual(BUILD_ORIGIN);
    });
});

describe("origin on backup restore", () => {
    // A pre-versioning backup carries no origin at all; the cast models that legacy shape.
    const legacyBackupProfile = { id: "b1", name: "Restored", type: "password" } as ProfileInfo;
    const backupProfile = (origin: ProfileOrigin): ProfileInfo => ({ ...legacyBackupProfile, origin });

    test("copies the backup profile's origin verbatim, not the current build's", async () => {
        // Same generation, but created by an older build — those versions must survive the restore.
        const origin: ProfileOrigin = { sentinel: BUILD_ORIGIN.sentinel, walletVersion: "0.13.3", aztecVersion: "4.3.0" };
        const service = await createService();

        const restored = await service.restore(backupProfile(origin), MASTER_KEY, "password123");

        expect(restored.restoreError).toBeUndefined();
        expect(restored.origin).toEqual(origin);
    });

    test("rejects a backup from a different profile generation", async () => {
        const origin: ProfileOrigin = { sentinel: "8", walletVersion: "0.13.3", aztecVersion: "4.3.0" };
        const service = await createService();

        const restored = await service.restore(backupProfile(origin), MASTER_KEY, "password123");

        expect(restored.restoreError).toBe("Backup profile is from an incompatible generation");
        expect(await service.getProfiles()).toEqual([]);
    });

    test("rejects a pre-versioning backup without origin", async () => {
        const service = await createService();

        const restored = await service.restore(legacyBackupProfile, MASTER_KEY, "password123");

        expect(restored.restoreError).toBe("Backup predates profile versioning");
        expect(await service.getProfiles()).toEqual([]);
    });
});
