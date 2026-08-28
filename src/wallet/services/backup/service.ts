import { ServiceCollection, ServiceSpec } from "@/wallet/base";
import { encryptBackupText, serializeBackup } from "./format";
import { ExportJob } from "./jobs";
import { Service } from "@/wallet/base/background";
import { ILogger } from "@/wallet/logger";
import type { AccountService } from "@/wallet/services/account/service";
import { ACCOUNT_SERVICE_NAME } from "@/wallet/services/account/spec";
import type { AccountStateService } from "@/wallet/services/account-state/service";
import { ACCOUNT_STATE_SERVICE_NAME } from "@/wallet/services/account-state/spec";
import type { AuthRegistryService } from "@/wallet/services/auth-registry/service";
import { AUTH_REGISTRY_SERVICE_NAME } from "@/wallet/services/auth-registry/spec";
import type { ConfigService } from "@/wallet/services/config/service";
import { CONFIG_SERVICE_NAME } from "@/wallet/services/config/spec";
import type { ContactService } from "@/wallet/services/contact/service";
import { CONTACT_SERVICE_NAME } from "@/wallet/services/contact/spec";
import type { FpcService } from "@/wallet/services/fpc/service";
import { FPC_SERVICE_NAME } from "@/wallet/services/fpc/spec";
import type { NetworkService } from "@/wallet/services/network/service";
import { NETWORK_SERVICE_NAME } from "@/wallet/services/network/spec";
import type { ProfileService } from "@/wallet/services/profile/service";
import { PROFILE_SERVICE_NAME } from "@/wallet/services/profile/spec";
import type { TokenService } from "@/wallet/services/token/service";
import { TOKEN_SERVICE_NAME } from "@/wallet/services/token/spec";
import type { TokenBalanceService } from "@/wallet/services/token-balance/service";
import { TOKEN_BALANCE_SERVICE_NAME } from "@/wallet/services/token-balance/spec";
import type { TransactionService } from "@/wallet/services/transaction/service";
import { TRANSACTION_SERVICE_NAME } from "@/wallet/services/transaction/spec";
import { BACKUP_ERRORS, BACKUP_SERVICE_NAME, Events, Methods, StartedExport } from "./spec";

export * from "./spec";

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
    private job?: ExportJob;
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

}
