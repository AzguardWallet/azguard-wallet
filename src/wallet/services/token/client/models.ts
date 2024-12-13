import { FnImpl } from "@/wallet/utils/fn";

/**
 * Token info.
 */
export class TokenInfo {
    /**
     * Creates Token instance.
     * @param id Internal id.
     * @param chainId Chain id.
     * @param contract Token contract address.
     * @param name Token name.
     * @param symbol Token symbol.
     * @param decimals Token decimals.
     * @param hasPublicBalances Whether or not the token has this functionality.
     * @param hasPublicTransfers Whether or not the token has this functionality.
     * @param hasPublicToPrivateTransfers Whether or not the token has this functionality.
     * @param hasPrivateBalances Whether or not the token has this functionality.
     * @param hasPrivateTransfers Whether or not the token has this functionality.
     * @param hasPrivateToPublicTransfers Whether or not the token has this functionality.
     */
    constructor(
        public readonly id: number,
        public readonly chainId: number,
        public readonly contract: string,
        public readonly name: string,
        public readonly symbol: string,
        public readonly decimals: number,
        public readonly hasPublicBalances: boolean,
        public readonly hasPublicTransfers: boolean,
        public readonly hasPublicToPrivateTransfers: boolean,
        public readonly hasPrivateBalances: boolean,
        public readonly hasPrivateTransfers: boolean,
        public readonly hasPrivateToPublicTransfers: boolean,
    ) {}
}

/**
 * Token interface
 */
export class TokenInterface {
    /**
     * Whether or not the token has complete functionality
     */
    public readonly isComplete: boolean;

    /**
     * Creates TokenInterface instance
     * @param chainId Chain id.
     * @param contract Contract address.
     * @param getNameFn Function to get token name.
     * @param getNameFnCandidates Functions with `getNameFn`-like signature.
     * @param getSymbolFn Function to get token symbol.
     * @param getSymbolFnCandidates Functions with `getSymbolFn`-like signature.
     * @param getDecimalsFn Function to get token decimals.
     * @param getDecimalsFnCandidates Functions with `getDecimalsFn`-like signature.
     * @param balanceOfPublicFn Function to get public balance.
     * @param balanceOfPublicFnCandidates Functions with `balanceOfPublicFn`-like signature.
     * @param balanceOfPrivateFn Function to get private balance.
     * @param balanceOfPrivateFnCandidates Functions with `balanceOfPrivateFn`-like signature.
     * @param transferPublicFn Function to make public transfer.
     * @param transferPublicFnCandidates Functions with `transferPublicFn`-like signature.
     * @param transferPrivateFn Function to make private transfer.
     * @param transferPrivateFnCandidates Functions with `transferPrivateFn`-like signature.
     * @param transferPublicToPrivateFn Function to make public to private transfer.
     * @param transferPublicToPrivateFnCandidates Functions with `transferPublicToPrivateFn`-like signature.
     * @param transferPrivateToPublicFn Function to make private to public transfer.
     * @param transferPrivateToPublicFnCandidates Functions with `transferPrivateToPublicFn`-like signature.
     */
    constructor(
        public readonly chainId: number,
        public readonly contract: string,
        
        public readonly getNameFn: FnImpl | undefined,
        public readonly getNameFnCandidates: FnImpl[],
        
        public readonly getSymbolFn: FnImpl | undefined,
        public readonly getSymbolFnCandidates: FnImpl[],
        
        public readonly getDecimalsFn: FnImpl | undefined,
        public readonly getDecimalsFnCandidates: FnImpl[],
        
        public readonly balanceOfPublicFn: FnImpl | undefined,
        public readonly balanceOfPublicFnCandidates: FnImpl[],
        
        public readonly balanceOfPrivateFn: FnImpl | undefined,
        public readonly balanceOfPrivateFnCandidates: FnImpl[],
        
        public readonly transferPublicFn: FnImpl | undefined,
        public readonly transferPublicFnCandidates: FnImpl[],
        
        public readonly transferPrivateFn: FnImpl | undefined,
        public readonly transferPrivateFnCandidates: FnImpl[],
        
        public readonly transferPublicToPrivateFn: FnImpl | undefined,
        public readonly transferPublicToPrivateFnCandidates: FnImpl[],
        
        public readonly transferPrivateToPublicFn: FnImpl | undefined,
        public readonly transferPrivateToPublicFnCandidates: FnImpl[],
    ) {
        this.isComplete =
            !!getNameFn &&
            !!getSymbolFn &&
            !!getDecimalsFn &&
            !!balanceOfPrivateFn &&
            !!balanceOfPublicFn &&
            !!transferPublicFn &&
            !!transferPrivateFn &&
            !!transferPublicToPrivateFn &&
            !!transferPrivateToPublicFn;
    }
}