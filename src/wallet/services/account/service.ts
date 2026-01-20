import type { Fr } from "@aztec/foundation/curves/bn254";
import { poseidon2Hash } from "@aztec/foundation/crypto/poseidon";
import { ILogger } from "@/wallet/logger";
import { Restored, ServiceCollection, ServiceSpec } from "@/wallet/base";
import { Service } from "@/wallet/base/background";
import { ProfileService, ProfileInfo } from "@/wallet/services/profile/service";
import { EntityStorage, StorageType } from "@/wallet/storage";
import { array_max, hasIntersectionByKeys } from "@/wallet/utils";
import { EventHandler } from "@/wallet/utils/event-handler";
import { AzguardV0, IAccountContract } from "./contracts";
import { ACCOUNT_SERVICE_NAME, AccountType, Account, Events, Methods } from "./spec";

export * from "./spec";

export class AccountService extends Service<Methods, Events> implements ServiceSpec<Methods, Events> {
    public static name = ACCOUNT_SERVICE_NAME;

    public readonly onAccountAdded = new EventHandler<Account>();
    public readonly onAccountUpdated = new EventHandler<Account>();
    public readonly onAccountDeleted = new EventHandler<Account>();

    private readonly storage = new EntityStorage<Account>("azguard:core:accounts", StorageType.Local);

    private profileService: ProfileService = null!;

    public constructor(logger: ILogger) {
        super(ACCOUNT_SERVICE_NAME, logger);
    }

    protected async init(services: ServiceCollection): Promise<void> {
        this.profileService = services.get(ProfileService.name);
        this.profileService.onProfileDeleted.add(this.onProfileDeleted);
    }

    public async getAccounts(profileId: string, chainId: number, all?: boolean): Promise<Account[]> {
        await this.ensureInitialized();
        return (await this.storage.getValues()).filter(
            x => x.profileId === profileId && x.chainId === chainId && (all || x.visible),
        );
    }

    public async getAccount(profileId: string, chainId: number, address: string): Promise<Account | undefined> {
        await this.ensureInitialized();
        const account = await this.storage.get(address);
        return account?.profileId === profileId && account.chainId === chainId ? account : undefined;
    }

    public async createAccount(profileId: string, chainId: number, type: AccountType, name: string): Promise<Account> {
        await this.ensureInitialized();
        const accounts = (await this.storage.getValues()).filter(
            x => x.profileId === profileId && x.chainId === chainId,
        );
        const index = accounts.length > 0 ? array_max(accounts.filter(x => x.type === type).map(x => +x.index)) + 1 : 0;
        const secret = await this.deriveAccountSecret(profileId, chainId, type, index);
        let address: string;
        switch (type) {
            case AccountType.Azguard_v0:
                address = (await AzguardV0.new(secret, this.logger)).address.toString();
                break;
            default:
                throw new Error("unsupported account type");
        }
        const account: Account = {
            profileId,
            chainId,
            address,
            index,
            type,
            name,
            visible: true,
        };
        await this.storage.set(address, account);
        this.emit("onAccountAdded", account);
        return account;
    }

    public async changeAccountName(
        profileId: string,
        chainId: number,
        address: string,
        name: string,
    ): Promise<Account | undefined> {
        const account = await this.storage.get(address);
        if (account?.profileId !== profileId || account.chainId !== chainId) {
            return undefined;
        }
        if (account.name !== name) {
            account.name = name;
            await this.storage.set(address, account);
            this.emit("onAccountUpdated", account);
        }
        return account;
    }

    public async changeAccountVisibility(
        profileId: string,
        chainId: number,
        address: string,
        visible: boolean,
    ): Promise<Account | undefined> {
        const account = await this.storage.get(address);
        if (account?.profileId !== profileId || account.chainId !== chainId) {
            return undefined;
        }
        if (account.visible !== visible) {
            account.visible = visible;
            await this.storage.set(address, account);
            this.emit("onAccountUpdated", account);
        }
        return account;
    }

    public async getAccountContract(profileId: string, chainId: number, address: string): Promise<IAccountContract> {
        await this.ensureInitialized();
        const account = await this.storage.get(address);
        if (account?.profileId !== profileId || account.chainId !== chainId) {
            throw new Error("unknown account address");
        }
        let accountContract: IAccountContract;
        switch (account.type) {
            case AccountType.Azguard_v0: {
                const secret = await this.deriveAccountSecret(profileId, chainId, account.type, account.index);
                accountContract = await AzguardV0.new(secret, this.logger);
                break;
            }
            default:
                throw new Error("unknown account type");
        }
        if (accountContract.address.toString() !== address) {
            throw new Error("account address inconsistency");
        }
        return accountContract;
    }

    private async deriveAccountSecret(profileId: string, chainId: number, type: number, index: number): Promise<Fr> {
        const master = await this.profileService.getProfileSecret(profileId);
        if (!master) {
            throw new Error("unauthorized");
        }
        return poseidon2Hash([master, chainId, type, index]);
    }

    private readonly onProfileDeleted = async (profile: ProfileInfo) => {
        this.logDebug(`profile ${profile.id} deleted, remove related accounts`);
        const accounts = (await this.storage.getValues()).filter(x => x.profileId === profile.id);
        for (const account of accounts) {
            this.logDebug(`remove account ${account.address}`);
            await this.storage.delete(account.address);
            this.emit("onAccountDeleted", account);
        }
    };

    public async backup(): Promise<Account[]> {
        const profile = await this.profileService.getActiveProfile();
        if (!profile) {
            throw new Error("Profile locked");
        }

        return (await this.storage.getValues()).filter(
            x => x.profileId === profile.id
        );
    }

    public async restore(accounts: Account[]): Promise<Restored<Account>[]> {
        await this.ensureInitialized();

        const result: Restored<Account>[] = [];

        const hasIntersectionByAddress = hasIntersectionByKeys(
            await this.storage.getValues(),
            accounts,
            ["address"],
        );
        if (hasIntersectionByAddress) throw new Error("Duplicate address");
        
        for (const account of accounts) {
            try {
                await this.storage.set(account.address, account);
                result.push(account);
            } catch (err) {
                result.push({
                    ...account,
                    restoreError: err instanceof Error ? err.message : err,
                })
            }
        }

        return result;
    }
}
