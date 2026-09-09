import { IService, Restored, ServiceCollection, ServiceSpec } from "@/wallet/base";
import {
    ParsedBackup,
    encryptBackupText,
    serializeBackup,
    validateBackup,
} from "./format";
import { ExportJob, ImportJob } from "./jobs";
import { Service } from "@/wallet/base/background";
import { ILogger } from "@/wallet/logger";
import type { AccountService } from "@/wallet/services/account/service";
import { ACCOUNT_ERRORS, ACCOUNT_SERVICE_NAME, Account } from "@/wallet/services/account/spec";
import type { AccountStateService } from "@/wallet/services/account-state/service";
import { ACCOUNT_STATE_SERVICE_NAME, BackupAccountState } from "@/wallet/services/account-state/spec";
import type { AuthRegistryService } from "@/wallet/services/auth-registry/service";
import { AUTH_REGISTRY_SERVICE_NAME } from "@/wallet/services/auth-registry/spec";
import type { ConfigService } from "@/wallet/services/config/service";
import { CONFIG_SERVICE_NAME } from "@/wallet/services/config/spec";
import type { ContactService } from "@/wallet/services/contact/service";
import { CONTACT_SERVICE_NAME } from "@/wallet/services/contact/spec";
import type { FpcService } from "@/wallet/services/fpc/service";
import { FPC_SERVICE_NAME, FpcInfo } from "@/wallet/services/fpc/spec";
import type { NetworkService } from "@/wallet/services/network/service";
import { NETWORK_SERVICE_NAME, Network } from "@/wallet/services/network/spec";
import type { ProfileService } from "@/wallet/services/profile/service";
import { PROFILE_SERVICE_NAME } from "@/wallet/services/profile/spec";
import type { TokenService } from "@/wallet/services/token/service";
import { TOKEN_SERVICE_NAME, Token } from "@/wallet/services/token/spec";
import type { TokenBalanceService } from "@/wallet/services/token-balance/service";
import { TOKEN_BALANCE_SERVICE_NAME, TokenBalanceRaw } from "@/wallet/services/token-balance/spec";
import type { TransactionService } from "@/wallet/services/transaction/service";
import { TRANSACTION_SERVICE_NAME } from "@/wallet/services/transaction/spec";
import { getErrorMessage } from "@/wallet/utils/errors";
import {
    BACKUP_ERRORS,
    BACKUP_SERVICE_NAME,
    BackupInspection,
    Events,
    ImportReport,
    Methods,
    StartedExport,
} from "./spec";

export * from "./spec";

/**
 * Restore payloads come from JSON.parse of the file, so calls go through this loosened
 * surface. The concrete services keep their typed overrides.
 */
// TODO: `cleanup/backup-restore` dissolve together with the any-typed backup/restore
// stubs on the Service base class once the restore calls are explicit per service
type RestoreTarget = IService & { restore(items: unknown): Promise<Restored<unknown>[]> };

export class BackupService
    extends Service<Methods, Events>
    implements ServiceSpec<Methods, Events> {
    public static name = BACKUP_SERVICE_NAME;

    private profileService!: ProfileService;
    private networkService!: NetworkService;
    private accountService!: AccountService;
    private transactionService!: TransactionService;
    private tokenService!: TokenService;
    private tokenBalanceService!: TokenBalanceService;
    private accountStateService!: AccountStateService;
    private authRegistryService!: AuthRegistryService;
    private fpcService!: FpcService;
    private contactService!: ContactService;
    private configService!: ConfigService;
    private restoreTail: RestoreTarget[] = [];
    private job?: ImportJob | ExportJob;
    private nextOp = 1;

    public constructor(logger: ILogger) {
        super(BACKUP_SERVICE_NAME, logger);
    }

    protected async init(services: ServiceCollection) {
        this.profileService = services.get<ProfileService>(PROFILE_SERVICE_NAME);
        this.networkService = services.get<NetworkService>(NETWORK_SERVICE_NAME);
        this.accountService = services.get<AccountService>(ACCOUNT_SERVICE_NAME);
        this.transactionService = services.get<TransactionService>(TRANSACTION_SERVICE_NAME);
        this.tokenService = services.get<TokenService>(TOKEN_SERVICE_NAME);
        this.tokenBalanceService = services.get<TokenBalanceService>(TOKEN_BALANCE_SERVICE_NAME);
        this.accountStateService = services.get<AccountStateService>(ACCOUNT_STATE_SERVICE_NAME);
        this.authRegistryService = services.get<AuthRegistryService>(AUTH_REGISTRY_SERVICE_NAME);
        this.fpcService = services.get<FpcService>(FPC_SERVICE_NAME);
        this.contactService = services.get<ContactService>(CONTACT_SERVICE_NAME);
        this.configService = services.get<ConfigService>(CONFIG_SERVICE_NAME);
        this.profileService.onActiveProfileChanged.add(() => {
            this.job = undefined;
        });
        // TODO: `cleanup/backup-restore` replace the generic tail with one explicit,
        // typed restore call per service, as assembleBackupFile already reads
        this.restoreTail = [
            TRANSACTION_SERVICE_NAME,
            TOKEN_BALANCE_SERVICE_NAME,
            ACCOUNT_STATE_SERVICE_NAME,
            AUTH_REGISTRY_SERVICE_NAME,
            FPC_SERVICE_NAME,
            CONTACT_SERVICE_NAME,
            CONFIG_SERVICE_NAME,
        ].map(name => services.get<RestoreTarget>(name));
    }

    public async beginExport(
        masterKey: string,
        encryptionPassword?: string,
    ): Promise<StartedExport> {
        await this.ensureInitialized();
        // NOTE: eviction happens at begin, win or lose — a throwing begin leaves no job behind
        this.job = undefined;
        // master parity: the plain download is pretty-printed for human eyes, the
        // encrypted container seals the compact form — nobody reads inside it
        let file: string;
        if (encryptionPassword) {
            const compact = await this.assembleBackupFile(masterKey);
            file = await encryptBackupText(compact, encryptionPassword);
        } else {
            file = await this.assembleBackupFile(masterKey, 2);
        }
        const job = new ExportJob(this.nextOp++, file);
        this.job = job;
        return { op: job.id, chunks: job.chunks };
    }

    public async getExportChunk(op: number, index: number): Promise<string> {
        const job = this.requireExport(op);
        try {
            return job.getChunk(index);
        } catch (error) {
            this.job = undefined;
            throw error;
        }
    }

    public async finishExport(op: number): Promise<void> {
        if (this.job instanceof ExportJob && this.job.id === op) {
            this.job = undefined;
        }
    }

    public async beginImport(chunks: number): Promise<number> {
        await this.ensureInitialized();
        await this.ensureNoOpenSession();
        // NOTE: eviction happens at begin, win or lose — a throwing begin leaves no job behind
        this.job = undefined;
        this.job = new ImportJob(this.nextOp++, chunks);
        return this.job.id;
    }

    public async putImportChunk(op: number, index: number, data: string): Promise<void> {
        const job = this.requireImport(op);
        try {
            job.put(index, data);
        } catch (error) {
            this.job = undefined;
            throw error;
        }
    }

    public async inspectImport(op: number): Promise<BackupInspection> {
        const job = this.requireImport(op);
        const content = job.getContent();
        if (content.kind === "encrypted") {
            return { stage: "needs-password", profileType: null, profileName: null };
        }
        if (content.kind === "unknown") {
            return { stage: "unrecognized", profileType: null, profileName: null };
        }
        // the peek is honest about nulls: the fields cross JSON, a pre-validation
        // file guarantees nothing — a JSON file with no readable profile is unrecognized
        const profile = job.parse().data?.profile as { type?: string; name?: string } | undefined;
        const profileType =
            profile?.type === "password" || profile?.type === "passkey" ? profile.type : null;
        return {
            stage: profileType ? "ready" : "unrecognized",
            profileType,
            profileName: profile?.name ?? null,
        };
    }

    public async abortImport(op: number): Promise<void> {
        if (this.job instanceof ImportJob && this.job.id === op) {
            this.job = undefined;
        }
    }

    public async decryptImport(op: number, password: string): Promise<BackupInspection> {
        await this.requireImport(op).decrypt(password);
        return this.inspectImport(op);
    }

    public async finishImport(op: number, password?: string): Promise<ImportReport> {
        await this.ensureNoOpenSession();
        const backup = this.requireImport(op).parse();
        try {
            return await this.restoreBackup(backup, password);
        } finally {
            this.job = undefined;
        }
    }

    /**
     * A restore never runs beside an open profile session. Restore is the only caller
     * that hands PXE another profile's networks, so exclusivity keeps the live PXE cache
     * serving one profile at a time. Checked at begin (early refusal) and at finish
     * (a session may open mid-transfer).
     */
    private async ensureNoOpenSession(): Promise<void> {
        if (await this.profileService.getActiveProfile()) {
            throw new Error(BACKUP_ERRORS.sessionOpen);
        }
    }

    /**
     * The op ticket names which job a call belongs to: a call carrying a stale op lost
     * the slot to a newer begin* and must fail loudly instead of feeding the winner.
     */
    private requireExport(op: number): ExportJob {
        if (!(this.job instanceof ExportJob)) {
            throw new Error("No export in progress");
        }
        if (this.job.id !== op) {
            throw new Error(BACKUP_ERRORS.superseded);
        }
        return this.job;
    }

    private requireImport(op: number): ImportJob {
        if (!(this.job instanceof ImportJob)) {
            throw new Error("No import in progress");
        }
        if (this.job.id !== op) {
            throw new Error(BACKUP_ERRORS.superseded);
        }
        return this.job;
    }

    /**
     * One explicit call per service, in file order: the key order of `data` is part of
     * the format. A service whose backup() returns undefined has no section.
     */
    private async assembleBackupFile(masterKey: string, space?: number): Promise<string> {
        const data: Record<string, unknown> = {};
        const profile = await this.profileService.backup();
        if (profile !== undefined) {
            data[PROFILE_SERVICE_NAME] = profile;
        }
        data[NETWORK_SERVICE_NAME] = await this.networkService.backup();
        data[ACCOUNT_SERVICE_NAME] = await this.accountService.backup();
        const txs = await this.transactionService.backup();
        if (txs !== undefined) {
            data[TRANSACTION_SERVICE_NAME] = txs;
        }
        data[TOKEN_SERVICE_NAME] = await this.tokenService.backup();
        data[TOKEN_BALANCE_SERVICE_NAME] = await this.tokenBalanceService.backup();
        const accountState = await this.accountStateService.backup();
        if (accountState !== undefined) {
            data[ACCOUNT_STATE_SERVICE_NAME] = accountState;
        }
        const authwits = await this.authRegistryService.backup();
        if (authwits !== undefined) {
            data[AUTH_REGISTRY_SERVICE_NAME] = authwits;
        }
        data[FPC_SERVICE_NAME] = await this.fpcService.backup();
        data[CONTACT_SERVICE_NAME] = await this.contactService.backup();
        data[CONFIG_SERVICE_NAME] = await this.configService.backup();
        return await serializeBackup(masterKey, data, space);
    }

    private async restoreBackup(parsed: ParsedBackup, password?: string): Promise<ImportReport> {
        const backup = await validateBackup(parsed);

        const { profile, data } = backup;
        const newProfile = await this.profileService.restore(profile, backup.masterKey, password);
        if (newProfile.restoreError) {
            throw new Error(getErrorMessage(newProfile.restoreError));
        }
        const { restoreError, ...profileInfo } = newProfile;
        const report: ImportReport = { profile: profileInfo, failures: {} };
        try {
            if (newProfile.id !== profile.id) {
                this.remapProfileIds(data, newProfile.id);
            }

            const oldNetworks = data[NETWORK_SERVICE_NAME] as Network[];
            const newNetworks = await this.networkService.restore(oldNetworks);
            const createdNetworks = newNetworks.filter(n => !n.restoreError);
            if (!createdNetworks.length) {
                throw new Error(BACKUP_ERRORS.noNetworks);
            }
            this.remapNetworkIds(data, oldNetworks, newNetworks);
            this.reportFailures(report, NETWORK_SERVICE_NAME, newNetworks);

            try {
                const newAccounts =
                    await this.accountService.restore(data[ACCOUNT_SERVICE_NAME] as Account[]);
                this.reportFailures(report, ACCOUNT_SERVICE_NAME, newAccounts);
            } catch (error) {
                if (getErrorMessage(error) === ACCOUNT_ERRORS.duplicateAddress) {
                    throw new Error(BACKUP_ERRORS.profileExists);
                }
                throw error;
            }

            const oldTokens = data[TOKEN_SERVICE_NAME] as Token[];
            const newTokens = await this.tokenService.restore(oldTokens);
            this.remapTokenBalances(data, oldTokens, newTokens);
            this.reportFailures(report, TOKEN_SERVICE_NAME, newTokens);

            for (const service of this.restoreTail) {
                const items = data[service.name];
                if (!Array.isArray(items)) continue;
                // NOTE: no active profile yet — account-state and fpc get the
                // networks by argument
                let restored: Restored<unknown>[];
                if (service.name === ACCOUNT_STATE_SERVICE_NAME) {
                    restored = (await this.accountStateService.restore(
                        items as BackupAccountState[],
                        createdNetworks,
                    )) as Restored<unknown>[];
                } else if (service.name === FPC_SERVICE_NAME) {
                    restored = await this.fpcService.restore(items as FpcInfo[], createdNetworks);
                } else {
                    restored = await service.restore(items);
                }
                this.reportFailures(report, service.name, restored);
            }

            return report;
        } catch (error) {
            await this.deleteProfileQuietly(newProfile.id);
            throw error;
        }
    }

    /**
     * A restored record keeps pointing at the backup's profile id; when the restore
     * minted a different id, every profileId field follows it.
     */
    // TODO: `cleanup/backup-restore` the remap family below is a symptom: services mint
    // fresh ids on restore while records reference by id. The restore contract should
    // carry the target ids explicitly instead of patching the payload afterwards.
    private remapProfileIds(data: Record<string, unknown>, newProfileId: string) {
        const patchProfileIds = (items: unknown[]) => items.map(item =>
            item && typeof item === "object" && "profileId" in item
                ? { ...item, profileId: newProfileId }
                : item,
        );
        for (const key of Object.keys(data)) {
            const value = data[key];
            if (Array.isArray(value)) {
                data[key] = patchProfileIds(value);
            }
        }
    }

    private remapNetworkIds(
        data: Record<string, unknown>,
        oldNetworks: Network[],
        newNetworks: Restored<Network>[],
    ) {
        const networkIdMap = new Map<string, string>();
        for (const network of newNetworks) {
            const oldNetwork = oldNetworks.find(n =>
                n.name === network.name &&
                n.rpcUrl === network.rpcUrl &&
                n.chainId === network.chainId,
            );
            if (oldNetwork && oldNetwork.id !== network.id) {
                networkIdMap.set(oldNetwork.id, network.id);
            }
        }
        if (!networkIdMap.size) return;
        for (const key of Object.keys(data)) {
            const items = data[key];
            if (!Array.isArray(items)) continue;
            data[key] = items.map(item => {
                if (item && typeof item === "object" && "networkId" in item) {
                    const newId = networkIdMap.get((item as { networkId: string }).networkId);
                    if (newId !== undefined) return { ...item, networkId: newId };
                }
                return item;
            });
        }
    }

    /**
     * Restored tokens get fresh ids, so each balance follows its token by (chainId,
     * contract) — not contract alone: canonical contracts (Fee Juice) share one address
     * on every chain, and a bare-contract key collapses all chains' balances onto
     * whichever token came last. A balance whose token failed to restore is dropped.
     */
    // TODO: consider dropping balance restore entirely — the rows are a display cache
    // the sync rebuilds, and this remap dies with them
    private remapTokenBalances(
        data: Record<string, unknown>,
        oldTokens: Token[],
        newTokens: Restored<Token>[],
    ) {
        const tokenBalances = data[TOKEN_BALANCE_SERVICE_NAME] as TokenBalanceRaw[] | undefined;
        if (!tokenBalances?.length) return;
        const oldIdToKey = new Map(oldTokens.map(t => [t.id, `${t.chainId}:${t.contract}`]));
        const keyToNewId = new Map(
            newTokens.filter(t => !t.restoreError).map(t => [`${t.chainId}:${t.contract}`, t.id]),
        );
        data[TOKEN_BALANCE_SERVICE_NAME] = tokenBalances.flatMap(tb => {
            const key = oldIdToKey.get(tb.token);
            const newId = key === undefined ? undefined : keyToNewId.get(key);
            return newId ? [{ ...tb, token: newId }] : [];
        });
    }

    /**
     * restoreError flattens to its message, because a raw Error crosses the RPC as {}.
     * The failure shapes per service are documented on ImportReport.
     */
    // TODO: `cleanup/backup-restore` revisit with the Restored<T>/restoreError contract
    private reportFailures(
        report: ImportReport,
        serviceName: string,
        restored: Restored<unknown>[],
    ) {
        // NOTE: restore() rides the any-typed base stubs, so an implementation can
        // hand back undefined despite the signature (cleanup/backup-restore retires this)
        if (!Array.isArray(restored)) return;
        const flat = <T extends { restoreError?: unknown }>(item: T) =>
            ({ ...item, restoreError: getErrorMessage(item.restoreError) });
        let failures: unknown[];
        if (serviceName === ACCOUNT_STATE_SERVICE_NAME) {
            failures = (restored as Restored<BackupAccountState>[]).flatMap(state => {
                const contracts = state.contracts.filter(x => x.restoreError).map(flat);
                const senders = state.senders.filter(x => x.restoreError).map(flat);
                return contracts.length || senders.length
                    ? [{ networkId: state.networkId, contracts, senders }]
                    : [];
            });
        } else {
            failures = restored.filter(x => x.restoreError).map(flat);
        }
        if (failures.length) {
            report.failures[serviceName] = failures;
        }
    }

    private async deleteProfileQuietly(profileId: string) {
        try {
            await this.profileService.deleteProfile(profileId);
        } catch (error) {
            this.logError(
                "Failed to delete the profile after an aborted import",
                getErrorMessage(error),
            );
        }
    }

}
