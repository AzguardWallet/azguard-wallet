import { getPXEServiceConfig, PXEServiceConfig } from "@aztec/pxe/config";
import { createPXEService } from "@aztec/pxe/client/bundle";
import { Fr } from "@aztec/foundation/fields";
import { AuthRegistryContractArtifact } from "@aztec/noir-contracts.js/AuthRegistry";
import { ContractInstanceDeployerContractArtifact } from "@aztec/noir-contracts.js/ContractInstanceDeployer";
import { ContractClassRegistererContractArtifact } from "@aztec/noir-contracts.js/ContractClassRegisterer";
import { MultiCallEntrypointContractArtifact } from "@aztec/noir-contracts.js/MultiCallEntrypoint";
import { FeeJuiceContractArtifact } from "@aztec/noir-contracts.js/FeeJuice";
import { FPCContractArtifact } from "@aztec/noir-contracts.js/FPC";
import { SponsoredFPCContractArtifact } from "@aztec/noir-contracts.js/SponsoredFPC";
import { TokenContractArtifact } from "@aztec/noir-contracts.js/Token";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { ContractArtifact } from "@aztec/stdlib/abi";
import {
    ContractClassWithId,
    ContractInstanceWithAddress,
    getContractClassFromArtifact,
    getContractInstanceFromDeployParams,
} from "@aztec/stdlib/contract";
import { ContractClassMetadata, ContractMetadata, createAztecNodeClient, PXE } from "@aztec/stdlib/interfaces/client";
import { Service } from "@/wallet/base/service";
import { EventMessage, ResponseMessage } from "@/wallet/base/messages";
import { ProfileService } from "@/wallet/services/profile";
import { NetworkService } from "@/wallet/services/network";
import { Network } from "@/wallet/services/network/client";
import { Lock } from "@/wallet/utils";
import { Logger } from "./logger";

const PXE_SERVICE_NAME = "pxe";

export class PxeService extends Service {
    private readonly lock = new Lock();
    private readonly pxes = new Map<number, PXE>();
    private readonly knownArtifacts = new Map<string, ContractArtifact>();
    private readonly knownClasses = new Map<string, ContractClassWithId>();
    private readonly knownInstances = new Map<string, ContractInstanceWithAddress>();

    constructor(
        private readonly profileService: ProfileService,
        private readonly networkService: NetworkService,
        emit: (event: EventMessage) => void,
    ) {
        super(PXE_SERVICE_NAME, emit);
		this.profileService.onActiveProfileChanged.push(this.onActiveProfileChanged);
        this.profileService.onProfileDeleted.push(this.onProfileDeleted);
        this.networkService.onDefaultNetworkChanged.push(this.onDefaultNetworkChanged);
    }

    public async process(): Promise<ResponseMessage | undefined> {
        return undefined;
    }

    public async getPXEClient(chainId: number): Promise<PXE> {
        try {
            await this.lock.enter();
            let pxe = this.pxes.get(chainId);
            if (!pxe) {
                const networks = await this.networkService.getNetworks(chainId);
                const network = networks.find(x => x.isDefault) ?? networks[0];
                pxe = await this.createPXE(network);
                this.pxes.set(chainId, pxe);
            }
            return pxe;
        }
        finally {
            this.lock.leave();
        }
    }

    public async getContractMetadata(chainId: number, address: AztecAddress): Promise<ContractMetadata> {
        const pxe = await this.getPXEClient(chainId);
        const metadata = await pxe.getContractMetadata(address);
        if (!metadata.contractInstance) {
            const node = await this.networkService.getNode(chainId);
            metadata.contractInstance = await node.getContract(address);
            if (!metadata.contractInstance) {
                if (!this.knownInstances.size) {
                    await this.initKnown();
                }
                metadata.contractInstance = this.knownInstances.get(address.toString());
            }
        }
        return metadata;
    }

    public async getContractClassMetadata(chainId: number, classId: Fr): Promise<ContractClassMetadata> {
        const pxe = await this.getPXEClient(chainId);
        const metadata = await pxe.getContractClassMetadata(classId, true);
        if (!metadata.artifact) {
            if (!this.knownArtifacts.size) {
                await this.initKnown();
            }
            metadata.artifact = this.knownArtifacts.get(classId.toString());
        }
        if (!metadata.contractClass) {
            if (!this.knownClasses.size) {
                await this.initKnown();
            }
            metadata.contractClass = this.knownClasses.get(classId.toString());
        }
        return metadata;
    }

    private async initKnown() {
        for (const artifact of [
            // protocol
            AuthRegistryContractArtifact,
            ContractInstanceDeployerContractArtifact,
            ContractClassRegistererContractArtifact,
            MultiCallEntrypointContractArtifact,
            FeeJuiceContractArtifact,
            // other
            FPCContractArtifact,
            SponsoredFPCContractArtifact,
            TokenContractArtifact,
        ]) {
            const contractClass = await getContractClassFromArtifact(artifact);
            this.knownArtifacts.set(contractClass.id.toString(), artifact);
            this.knownClasses.set(contractClass.id.toString(), contractClass);
        }

        const sponsoredFpcInstace = await getContractInstanceFromDeployParams(
            SponsoredFPCContractArtifact,
            {
                constructorArgs: [],
                salt: Fr.zero()
            }
        );
        this.knownInstances.set(sponsoredFpcInstace.address.toString(), sponsoredFpcInstace);
    }

    private async createPXE(network: Network) {
        //return createPXEClient(network.rpcUrl);
        const node = createAztecNodeClient(network.rpcUrl);

        const l1Contracts = await node.getL1ContractAddresses();
        const config = {
            ...getPXEServiceConfig(),
            l1Contracts,
        } as PXEServiceConfig;

        config.dataDirectory = `pxe/${network.profileId}/${network.chainId}`;
        config.proverEnabled = false;

        return await createPXEService(node, config, {
            loggers: {
                store: new Logger('pxe:data:indexeddb', 'trace'),
                pxe: new Logger('pxe:service', 'trace'),
                prover: new Logger('bb:wasm:lazy', 'trace'),
            }
        });
    }
    
    private readonly onActiveProfileChanged = async () => {
        try {
            await this.lock.enter();
            this.pxes.clear();
        }
        finally {
            this.lock.leave();
        }
    };
    
    private readonly onProfileDeleted = async (profileId: string) => {
        try {
            await this.lock.enter();
            this.pxes.clear();
            for (const db of await indexedDB.databases()) {
                if (db.name?.startsWith(`pxe/${profileId}`)) {
                    const _ = indexedDB.deleteDatabase(db.name);
                }
            }
        }
        finally {
            this.lock.leave();
        }
    };

    private readonly onDefaultNetworkChanged = async (network: Network) => {
        try {
            await this.lock.enter();
            this.pxes.delete(network.chainId);
        }
        finally {
            this.lock.leave();
        }
    };
}