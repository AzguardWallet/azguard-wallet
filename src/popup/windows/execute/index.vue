<script setup lang="ts">
/** Vendor */
import { onMounted, onUnmounted } from "vue"

/** Components */
// @ts-ignore
import FeeSettingsCard from "../../components/modules/send/FeeSettingsCard.vue"
// @ts-ignore
import NetworkBadge from "@/popup/components/modules/general/NetworkBadge.vue"

/** Utils */
import { trimAddress } from "@/utils/string"
import { getErrorData, getErrorMessage } from "@/wallet/utils/errors"

/** Services */
import { ProfileInfo, ProfileServiceClient } from "@/wallet/services/profile/client"
import { Network, NetworkServiceClient } from "@/wallet/services/network/client"
import { Account, AccountServiceClient } from "@/wallet/services/account/client"
import { ExecutionServiceClient, FeeSettings, TransferFeeEstimate, Operation } from "@/wallet/services/execution/client"
import {
	CaipAccount,
	CaipChain,
	DappInteractionServiceClient,
	ExecutionPayload,
} from "@/wallet/services/dapp-interaction/client"
import { DappMetadata } from "@/wallet/services/dapp-session/client"
import { OriginType } from "@/wallet/services/transaction/client"

type UIOperation = Operation & {
	network: Network
	account?: Account
}

type UIDappMetadata = DappMetadata & {
	loadingLogo?: boolean
	logoBlobUrl?: string
}

type UIError = {
	title: string
	tooltip: string
	type: string
}

/** Store */
import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()

/** Composables */
// @ts-ignore
const { loadExternalImage } = useExternalImage()

const profile = ref<ProfileInfo>()

const router = useRouter()

const requestId = ref<string>()
const payload = ref<ExecutionPayload>()

const session = ref()
const dapp = ref<UIDappMetadata>()
const operations = ref<UIOperation[]>([])
const accounts = ref<Account[]>([])

const isLoading = ref(false)
const isInteractionCancelled = ref(false)
const isWrongProfile = ref(false)
const processingError = ref<UIError>()

function setError(title: string, tooltip: string = title, type: string = "error") {
	processingError.value = {
		title,
		tooltip,
		type,
	}
}

function clearError() {
	processingError.value = undefined
}

/** Fee estimation state */
const feeEstimates = ref<Record<number, TransferFeeEstimate | undefined>>({})
const estimatingOps = ref<Record<number, boolean>>({})
const estimationTimers = ref<Record<number, ReturnType<typeof setTimeout>>>({})
const estimationCounters = ref<Record<number, number>>({})

const startEstimation = (opIndex: number, op: UIOperation, feeSettings: FeeSettings) => {
	if (estimationTimers.value[opIndex]) {
		clearTimeout(estimationTimers.value[opIndex])
	}
	estimationTimers.value[opIndex] = setTimeout(async () => {
		estimatingOps.value[opIndex] = true
		const counter = (estimationCounters.value[opIndex] ?? 0) + 1
		estimationCounters.value[opIndex] = counter
		try {
			const result = await executionService.estimateOperationFee(op, feeSettings)
			if (estimationCounters.value[opIndex] === counter) {
				feeEstimates.value[opIndex] = result
			}
		} catch (e) {
			console.warn("Fee estimation failed", e)
			if (estimationCounters.value[opIndex] === counter) {
				feeEstimates.value[opIndex] = undefined
			}
		} finally {
			if (estimationCounters.value[opIndex] === counter) {
				estimatingOps.value[opIndex] = false
			}
		}
	}, 500)
}

const init = async () => {
	try {
		profile.value = await profileService.getActiveProfile()
		requestId.value = router.currentRoute.value.query.requestId?.toString()
		if (!requestId.value) {
			throw new Error("Invalid interaction request id")
		}
		payload.value = (await interactionService.getInteractionPayload(requestId.value)) as ExecutionPayload
		dapp.value = payload.value.session.dappMetadata

		if (dapp.value.logo) {
			dapp.value.loadingLogo = true
			try {
				dapp.value.logoBlobUrl = await loadExternalImage(dapp.value.logo)
			} finally {
				dapp.value.loadingLogo = false
			}
		}

		if (profile.value?.id !== payload.value.session.profileId) {
			// TODO: redirect to sign in page with preconfigured profile id
			isWrongProfile.value = true
			throw new Error("Sign in with another profile")
		}
		const accountService = new AccountServiceClient()
		const networkService = new NetworkServiceClient()

		const getNetwork = async (caipChain: CaipChain): Promise<Network> => {
			const [_, chainId] = caipChain.split(":")
			const networks = await networkService.getNetworks(+chainId)
			if (networks.length === 0) {
				throw new Error("Network no longer exists")
			}
			return networks.find(x => x.isDefault) ?? networks[0]
		}

		const getNetworkAndAccount = async (caipAccount: CaipAccount): Promise<[Network, Account]> => {
			const [_, chainId, address] = caipAccount.split(":")
			const networks = await networkService.getNetworks(+chainId)
			if (networks.length === 0) {
				throw new Error("Network no longer exists")
			}
			const network = networks.find(x => x.isDefault) ?? networks[0]
			const account = await accountService.getAccount(profile.value!.id, network.chainId, address)
			if (!account) {
				throw new Error("Account no longer exists")
			}
			return [network, account]
		}

		const _accounts: Account[] = []
		const _operations: UIOperation[] = []
		for (const op of payload.value.params.operations) {
			switch (op.kind) {
				case "register_contract":
				case "register_sender":
				case "aztec_getContractClassMetadata":
				case "aztec_getContractMetadata":
				case "aztec_getChainInfo":
				case "aztec_registerSender":
				case "aztec_getAddressBook":
				case "aztec_registerContract":
				case "aztec_getPrivateEvents": {
					const network = await getNetwork(op.chain)
					_operations.push({
						...op,
						network,
						networkId: network.id,
					})
					break
				}
				case "aztec_getAccounts": {
					const network = await getNetwork(op.chain)
					const sessionAccounts = payload.value!.session.accounts
						.filter(x => x.startsWith(op.chain))
						.map(x => x.split(":").at(-1)!)
					_operations.push({
						...op,
						network,
						networkId: network.id,
						accounts: sessionAccounts,
					})
					break
				}
				case "get_complete_address":
				case "register_token":
				case "simulate_transaction":
				case "simulate_utility":
				case "simulate_views":
				case "aztec_simulateTx":
				case "aztec_simulateUtility":
				case "aztec_profileTx":
				case "aztec_createAuthWit": {
					const [network, account] = await getNetworkAndAccount(op.account)
					_operations.push({
						...op,
						network,
						networkId: network.id,
						account,
						accountAddress: account.address,
					})
					if (!_accounts.find(x => x.address === account.address)) {
						_accounts.push(account)
					}
					break
				}
				case "aztec_sendTx": {
					const [network, account] = await getNetworkAndAccount(op.account)
					_operations.push({
						...op,
						network,
						networkId: network.id,
						account,
						accountAddress: account.address,
						feeSettings:
							op.exec.feePayer !== undefined ? { paymentMethod: { kind: "embedded" } } : undefined!,
					})
					if (!_accounts.find(x => x.address === account.address)) {
						_accounts.push(account)
					}
					break
				}
				case "send_transaction": {
					const [network, account] = await getNetworkAndAccount(op.account)
					_operations.push({
						...op,
						network,
						networkId: network.id,
						account,
						accountAddress: account.address,
						feeSettings:
							op.fee?.embeddedFeePayment !== undefined
								? { paymentMethod: { kind: "embedded" } }
								: undefined!,
					})
					if (!_accounts.find(x => x.address === account.address)) {
						_accounts.push(account)
					}
					break
				}
				default: {
					throw new Error("Invalid operation kind")
				}
			}
		}
		session.value = payload.value.session
		operations.value = _operations
		accounts.value = _accounts
		accountService.disconnect()
		networkService.disconnect()
	} catch (error) {
		console.error(getErrorData(error))
		setError("Something went wrong")
	}
}

const onActiveProfileChanged = (_profile?: ProfileInfo) => {
	if (!_profile || _profile.id !== profile.value?.id) {
		reject()
	}
}

const onInteractionCancelled = (_requestId: string) => {
	if (requestId.value === _requestId) {
		isInteractionCancelled.value = true
	}
}

const approve = async () => {
	if (operations.value.find(x => x.kind === "send_transaction" && !x.feeSettings)) {
		setError(
			"Validation error",
			"You must specify fee payment method for each 'Send transaction' operations",
			"warning",
		)
		return
	}
	try {
		isLoading.value = true
		await profileService.refreshSession()
		/** @ts-ignore */
		const result = await executionService.executeOperations(operations.value, {
			type: OriginType.DAPP,
			name: dapp.value?.name ?? "Unknown dapp",
		})
		interactionService.resolveInteraction(requestId.value!, result)
		closeWindow(true)
	} catch (error) {
		setError("Processing error.", getErrorMessage(error))
	} finally {
		isLoading.value = false
	}
}

const reject = async () => {
	interactionService.rejectInteraction(requestId.value!, "User rejected")
	closeWindow(true)
}

const closeWindow = (interactionCompleted: boolean) => {
	if (interactionCompleted) {
		window.removeEventListener("beforeunload", reject)
	}
	chrome.windows.getCurrent(undefined, window => {
		if (window.id) {
			chrome.windows.remove(window.id)
		}
	})
}

const profileService = new ProfileServiceClient()
profileService.onActiveProfileChanged.add(onActiveProfileChanged)

const interactionService = new DappInteractionServiceClient()
interactionService.onInteractionCancelled.add(onInteractionCancelled)

const executionService = new ExecutionServiceClient()

onBeforeMount(async () => {
	if (!appStore.isLogined) {
		setTimeout(() => {
			appStore.pageAwaitingAuth = router.currentRoute.value.fullPath
			router.push({
				path: "/popup/auth",
			})
		}, 100)
	}
})

onMounted(async () => {
	profileService.connect()
	interactionService.connect()
	executionService.connect()
	await init()
	window.addEventListener("beforeunload", reject)
})

onUnmounted(() => {
	profileService.disconnect()
	interactionService.disconnect()
	executionService.disconnect()
	window.removeEventListener("beforeunload", reject)
})

const humanizeOperationKind = (str: string) => {
	if (str.startsWith("aztec_")) {
		// split camelCase
		str = str
			.substring(6)
			.replace("PXE", "Pxe")
			.replace("AuthWit", "Authwit")
			.replace(/([A-Z])/g, " $1")
			.toLowerCase()
	} else {
		// split snake_case
		str = str.replace("_", " ")
	}
	return `${str[0].toUpperCase()}${str.substring(1)}`
}

const showJson = () => {
	if (!requestId.value) return
	const url = new URL(chrome.runtime.getURL("src/popup/index.html#/windows/json"))
	url.searchParams.set("requestId", requestId.value)
	chrome.windows.create({ type: "popup", url: url.toString(), height: 700, width: 900 })
}
</script>

<template>
	<Flex v-if="appStore.isLogined" direction="column" justify="between" :class="$style.wrapper">
		<Flex direction="column" gap="16">
			<Flex align="center" justify="center" gap="8" :style="{ paddingTop: '8px' }">
				<Text size="16" weight="600" color="primary">Operation request</Text>
			</Flex>

			<Flex align="center" justify="center" gap="20">
				<Flex direction="column" align="center" justify="center" gap="6" :class="$style.avatar">
					<Icon v-if="dapp?.loadingLogo" :loading="true" name="dapp" size="48" color="tertiary" />
					<img v-else-if="dapp?.logoBlobUrl" width="48" height="48" :src="dapp?.logoBlobUrl" />
					<Icon v-else name="dapp" size="48" color="blue" />

					<Text size="13" weight="600" color="primary">
						{{ dapp?.name ?? "Unknown dapp" }}
					</Text>
				</Flex>

				<Flex
					align="center"
					gap="12"
					:class="[$style.status_icon, isLoading && $style.processing]"
					:style="{ paddingBottom: '13px' }"
				>
					<Icon name="left-connect" size="24" color="tertiary" />
					<Icon name="right-connect" size="24" color="tertiary" />
				</Flex>

				<Flex direction="column" align="center" justify="center" gap="6" :class="$style.avatar">
					<img width="48" height="48" src="@/assets/logo_lg.png" />

					<Text size="13" weight="600" color="primary">Azguard Wallet</Text>
				</Flex>
			</Flex>

			<Flex direction="column" align="center" justify="center" gap="8" :style="{ marginTop: '-4px' }">
				<Flex direction="column" align="center" justify="center" gap="4">
					<Text size="13" weight="600" color="primary"> {{ dapp?.url }} </Text>
					<Text size="13" color="primary">The dapp wants you to execute operation(s)</Text>
				</Flex>
				<Flex direction="column" align="center" justify="center" gap="4">
					<Text size="12" color="secondary">Make sure you trust the site you interact with</Text>
				</Flex>
			</Flex>

			<Flex
				v-if="operations.length"
				direction="column"
				align="start"
				justify="start"
				gap="8"
				style="padding-bottom: 8px"
			>
				<Flex wide justify="between">
					<Text size="14" weight="600" color="primary">Requested operations:</Text>
					<Icon @click="showJson" name="expand" size="16" color="tertiary" :class="$style.fullscreen_icon" />
				</Flex>

				<template v-for="(op, i) in operations" :key="i">
					<Flex v-if="op.kind === 'send_transaction'" direction="column" wide>
						<Flex
							:class="$style.operation"
							direction="column"
							wide
							style="
								margin-bottom: 0;
								border-bottom-right-radius: 0;
								border-bottom-left-radius: 0;
								border-bottom: none;
							"
						>
							<Flex wide justify="between">
								<Text size="14" color="primary">{{ humanizeOperationKind(op.kind) }}</Text>
								<NetworkBadge :network="op.network" />
							</Flex>
							<Flex :class="$style.prop">
								<Text size="12" color="secondary">From account:</Text>
								<Text size="12" color="primary">
									{{ op.account!.name }}
									<Text color="secondary">({{ trimAddress(op.account!.address) }})</Text>
								</Text>
							</Flex>
							<Flex :class="$style.prop">
								<Text size="12" color="secondary">Payload:</Text>
								<Flex direction="column" gap="4">
									<Text
										v-for="(action, j) in op.actions"
										:key="`${i}:${j}`"
										size="12"
										color="primary"
									>
										<template v-if="action.kind === 'call' || action.kind === 'encoded_call'">
											<Text color="secondary"> call </Text>
											{{ action.kind === "call" ? action.method : action.selector }}
											<Text color="secondary"> in </Text>
											<AddressDisplay
												:address="action.kind === 'call' ? action.contract : action.to"
											/>
										</template>
										<template v-else>
											{{ action.kind.replace("_", " ") }}
										</template>
									</Text>
								</Flex>
							</Flex>
						</Flex>
						<FeeSettingsCard
							:profile="profile"
							:network="op.network"
							:account="op.account"
							:modelValue="op.feeSettings"
							:feeEstimate="feeEstimates[i]"
							:isEstimating="estimatingOps[i]"
							@update:modelValue="
								($event?: FeeSettings) => {
									op.feeSettings = $event!
									clearError()
									if ($event) startEstimation(i, op, $event)
								}
							"
							style="border-top-left-radius: 0; border-top-right-radius: 0; opacity: 1"
						/>
					</Flex>
					<Flex v-else-if="op.kind === 'aztec_sendTx'" direction="column" wide>
						<Flex
							:class="$style.operation"
							direction="column"
							wide
							style="
								margin-bottom: 0;
								border-bottom-right-radius: 0;
								border-bottom-left-radius: 0;
								border-bottom: none;
							"
						>
							<Flex wide justify="between">
								<Text size="14" color="primary">{{ humanizeOperationKind(op.kind) }}</Text>
								<NetworkBadge :network="op.network" />
							</Flex>
							<Flex :class="$style.prop">
								<Text size="12" color="secondary">From account:</Text>
								<Text size="12" color="primary">
									{{ op.account!.name }}
									<Text color="secondary">({{ trimAddress(op.account!.address) }})</Text>
								</Text>
							</Flex>
							<Flex :class="$style.prop">
								<Text size="12" color="secondary">Payload:</Text>
								<Flex direction="column" gap="4">
									<Text
										v-for="(call, j) in op.exec.calls"
										:key="`${i}:${j}`"
										size="12"
										color="primary"
									>
										<Text color="secondary"> call </Text>
										{{ call.name ?? call.selector }}
										<Text color="secondary"> in </Text>
										<AddressDisplay :address="call.to" />
									</Text>
								</Flex>
							</Flex>
						</Flex>
						<FeeSettingsCard
							:profile="profile"
							:network="op.network"
							:account="op.account"
							:modelValue="op.feeSettings"
							:feeEstimate="feeEstimates[i]"
							:isEstimating="estimatingOps[i]"
							@update:modelValue="
								($event?: FeeSettings) => {
									op.feeSettings = $event!
									clearError()
									if ($event) startEstimation(i, op, $event)
								}
							"
							style="border-top-left-radius: 0; border-top-right-radius: 0; opacity: 1"
						/>
					</Flex>
					<Flex v-else :class="$style.operation" direction="column" wide>
						<Flex wide justify="between">
							<Text size="14" color="primary">{{ humanizeOperationKind(op.kind) }}</Text>
							<NetworkBadge :network="op.network" />
						</Flex>
						<Flex v-if="op.account" :class="$style.prop">
							<Text size="12" color="secondary">From account:</Text>
							<Text size="12" color="primary">
								{{ op.account!.name }}
								<Text color="secondary">({{ trimAddress(op.account!.address) }})</Text>
							</Text>
						</Flex>
						<template v-if="op.kind === 'register_contract'">
							<Flex :class="$style.prop">
								<Text size="12" color="secondary">Contract address:</Text>
								<AddressDisplay :address="op.address" />
								<!-- <Text size="12" color="primary">{{ trimAddress(op.address) }}</Text> -->
							</Flex>
						</template>
						<template v-else-if="op.kind === 'register_sender'">
							<Flex :class="$style.prop">
								<Text size="12" color="secondary">Sender address:</Text>
								<AddressDisplay :address="op.address" />
								<!-- <Text size="12" color="primary">{{ trimAddress(op.address) }}</Text> -->
							</Flex>
						</template>
						<template v-else-if="op.kind === 'register_token'">
							<Flex :class="$style.prop">
								<Text size="12" color="secondary">Token address:</Text>
								<AddressDisplay :address="op.address" />
								<!-- <Text size="12" color="primary">{{ trimAddress(op.address) }}</Text> -->
							</Flex>
						</template>
						<template v-else-if="op.kind === 'simulate_transaction'">
							<Flex :class="$style.prop">
								<Text size="12" color="secondary">Payload:</Text>
								<Flex direction="column" gap="4">
									<Text
										v-for="(action, j) in op.actions"
										:key="`${i}:${j}`"
										size="12"
										color="primary"
									>
										<template v-if="action.kind === 'call' || action.kind === 'encoded_call'">
											<Text color="secondary"> call </Text>
											{{ action.kind === "call" ? action.method : action.selector }}
											<Text color="secondary"> in </Text>
											<AddressDisplay
												:address="action.kind === 'call' ? action.contract : action.to"
											/>
											<!-- {{ trimAddress(action.contract || action.to) }} -->
										</template>
										<template v-else>
											{{ action.kind.replace("_", " ") }}
										</template>
									</Text>
								</Flex>
							</Flex>
						</template>
						<template v-else-if="op.kind === 'simulate_utility'">
							<Flex :class="$style.prop">
								<Text size="12" color="secondary">Contract address:</Text>
								<AddressDisplay :address="op.contract" />
								<!-- <Text size="12" color="primary">{{ trimAddress(op.contract) }}</Text> -->
							</Flex>
							<Flex :class="$style.prop">
								<Text size="12" color="secondary">Function:</Text>
								<Text size="12" color="primary">{{ op.method }}</Text>
							</Flex>
						</template>
						<template v-else-if="op.kind === 'simulate_views'">
							<Flex :class="$style.prop">
								<Text size="12" color="secondary">View calls:</Text>
								<Flex direction="column" gap="4">
									<Text v-for="(call, j) in op.calls" :key="`${i}:${j}`" size="12" color="primary">
										{{ call.kind === "call" ? call.method : call.selector }}
										<Text color="secondary"> in </Text>
										<AddressDisplay :address="call.kind === 'call' ? call.contract : call.to" />
										<!-- {{ trimAddress(call.contract || call.to) }} -->
									</Text>
								</Flex>
							</Flex>
						</template>
						<template v-else-if="op.kind === 'aztec_getContractClassMetadata'">
							<Flex :class="$style.prop">
								<Text size="12" color="secondary">Class id:</Text>
								<Text size="12" color="primary">{{ trimAddress(op.id.toString()) }}</Text>
							</Flex>
						</template>
						<template v-else-if="op.kind === 'aztec_getContractMetadata'">
							<Flex :class="$style.prop">
								<Text size="12" color="secondary">Contract address:</Text>
								<AddressDisplay :address="op.address.toString()" />
							</Flex>
						</template>
						<template v-else-if="op.kind === 'aztec_getPrivateEvents'">
							<Flex :class="$style.prop">
								<Text size="12" color="secondary">Contract address:</Text>
								<AddressDisplay :address="op.eventFilter.contractAddress.toString()" />
							</Flex>
						</template>
						<template v-else-if="op.kind === 'aztec_registerSender'">
							<Flex :class="$style.prop">
								<Text size="12" color="secondary">Sender address:</Text>
								<AddressDisplay :address="op.address.toString()" />
							</Flex>
						</template>
						<template v-else-if="op.kind === 'aztec_simulateTx'">
							<Flex :class="$style.prop">
								<Text size="12" color="secondary">Payload:</Text>
								<Flex direction="column" gap="4">
									<Text
										v-for="(call, j) in op.exec.calls"
										:key="`${i}:${j}`"
										size="12"
										color="primary"
									>
										<Text color="secondary"> call </Text>
										{{ call.name ?? call.selector }}
										<Text color="secondary"> in </Text>
										<AddressDisplay :address="call.to" />
									</Text>
								</Flex>
							</Flex>
						</template>
						<template v-else-if="op.kind === 'aztec_simulateUtility'">
							<Flex :class="$style.prop">
								<Text size="12" color="secondary">Contract address:</Text>
								<AddressDisplay :address="op.call.to.toString()" />
							</Flex>
							<Flex :class="$style.prop">
								<Text size="12" color="secondary">Function:</Text>
								<Text size="12" color="primary">{{ op.call.name ?? op.call.selector.toString() }}</Text>
							</Flex>
						</template>
						<template v-else-if="op.kind === 'aztec_profileTx'">
							<Flex :class="$style.prop">
								<Text size="12" color="secondary">Payload:</Text>
								<Flex direction="column" gap="4">
									<Text
										v-for="(call, j) in op.exec.calls"
										:key="`${i}:${j}`"
										size="12"
										color="primary"
									>
										<Text color="secondary"> call </Text>
										{{ call.name ?? call.selector }}
										<Text color="secondary"> in </Text>
										<AddressDisplay :address="call.to" />
									</Text>
								</Flex>
							</Flex>
						</template>
						<template v-else-if="op.kind === 'aztec_getChainInfo'">
							<Flex :class="$style.prop">
								<Text size="12" color="secondary">Retrieves chain ID and protocol version</Text>
							</Flex>
						</template>
						<template v-else-if="op.kind === 'aztec_getAddressBook'">
							<Flex :class="$style.prop">
								<Text size="12" color="secondary">Retrieves registered addresses</Text>
							</Flex>
						</template>
						<template v-else-if="op.kind === 'aztec_registerContract'">
							<Flex :class="$style.prop">
								<Text size="12" color="secondary">Contract address:</Text>
								<AddressDisplay :address="op.instance.address.toString()" />
							</Flex>
						</template>
						<template v-else-if="op.kind === 'aztec_createAuthWit'">
							<Flex v-if="op.messageHashOrIntent?.caller" :class="$style.prop">
								<Text size="12" color="secondary">Authorized caller:</Text>
								<AddressDisplay :address="op.messageHashOrIntent.caller.toString()" />
							</Flex>
						</template>
					</Flex>
				</template>
			</Flex>
		</Flex>

		<Flex direction="column" gap="10">
			<Tooltip v-if="processingError" side="top" position="start" :disabled="!processingError.tooltip">
				<Flex align="center" wide>
					<Icon name="info" size="14" :color="processingError.type === 'warning' ? 'orange' : 'red'" />
					<Text size="12" weight="600" color="secondary" :style="{ paddingLeft: '4px' }">
						{{ processingError.title }}
					</Text>
				</Flex>

				<template #content>
					<Text size="12" color="secondary">
						{{ processingError.tooltip }}
					</Text>
				</template>
			</Tooltip>

			<Flex align="center" justify="between" gap="12">
				<Button @click="reject" wide type="secondary" size="medium" :disabled="isLoading">
					<Text size="13">Reject</Text>
				</Button>

				<Button
					@click="approve"
					wide
					type="primary"
					size="medium"
					:loading="isLoading"
					:disabled="processingError"
				>
					<Text size="13" color="inverse"> {{ `${isLoading ? "Executing" : "Confirm"}` }} </Text>
				</Button>
			</Flex>
		</Flex>

		<Flex v-if="isWrongProfile" align="center" justify="center" :class="$style.notification_overlay">
			<Flex direction="column" align="center" gap="16" :class="$style.notification_content">
				<Text size="13" weight="600" color="primary"
					>You are signed in to a different profile. Please switch profiles and resend your request.</Text
				>

				<Button @click="closeWindow" type="primary" size="small" :style="{ width: '50%' }">
					<Text size="13" color="inverse">OK</Text>
				</Button>
			</Flex>
		</Flex>

		<Flex v-else-if="isInteractionCancelled" align="center" justify="center" :class="$style.notification_overlay">
			<Flex direction="column" align="center" gap="16" :class="$style.notification_content">
				<Text size="13" weight="600" color="primary">The operation request was cancelled</Text>

				<Button @click="closeWindow" type="primary" size="small" :style="{ width: '50%' }">
					<Text size="13" color="inverse">OK</Text>
				</Button>
			</Flex>
		</Flex>
	</Flex>
</template>

<style module>
.wrapper {
	overflow: auto;
	flex: 1;

	background: var(--card-bg);
	box-shadow: 0 0 0 1px var(--gray-5);

	border-top-left-radius: 24px;
	border-top-right-radius: 24px;

	padding: 12px;
}

& img {
	border-radius: 50%;
	transition: all 0.2s ease;
}

.avatar {
	position: relative;

	width: 80px;
	height: 80px;

	border-radius: 12px;
	background: var(--card-bg);

	text-align: center;
	white-space: nowrap;

	& img {
		border-radius: 50%;
		transition: all 0.2s ease;
	}

	& .icon_connectors {
		position: absolute;
		top: -12px;
		right: -12px;
		box-sizing: content-box;

		background: #101010;
		border-radius: 50%;

		padding: 3px;
	}
}

@keyframes loading {
	0% {
		opacity: 1;
	}

	25% {
		opacity: 0.8;
	}

	50% {
		opacity: 0.4;
	}

	70% {
		opacity: 0.8;
	}

	100% {
		opacity: 1;
	}
}

.status_icon {
	& svg {
		transition: all 0.5s ease;
	}

	& svg:first-child {
		fill: var(--green);

		transform: translateX(16px);

		filter: drop-shadow(0 0px 8px var(--green));
	}

	& svg:last-child {
		fill: var(--green);

		transform: translateX(-16px);

		filter: drop-shadow(0 0px 8px var(--green));
	}
}

.processing {
	animation: loading 2s infinite linear;
}

.section {
	width: 100%;
}

.operation {
	width: 100%;
	border-radius: 12px;
	border: 1px solid var(--gray-10);

	padding: 12px;
}

.prop {
	width: 100%;
	justify-content: space-between;
	padding-top: 12px;

	:last-child {
		text-align: right;
	}
}

.fullscreen_icon {
	cursor: pointer;
	&:hover {
		background: var(--op-10);
	}
}

.account {
	width: 100%;
	border-radius: 12px;
	box-shadow: inset 0 0 0 1px var(--gray-10), 0 1px 2px var(--gray-5);

	padding: 12px;

	transition: all 0.2s var(--bezier);
}

.networks {
	width: 100%;
	max-height: 170px;
	overflow: auto;
}

.network {
	width: 100%;
	border-radius: 12px;
	cursor: pointer;
	box-shadow: inset 0 0 0 1px var(--gray-10), 0 1px 2px var(--gray-5);

	padding: 12px;

	transition: all 0.2s var(--bezier);

	&:hover {
		background: var(--gray-3);
	}

	&:active {
		background: var(--gray-5);
	}
}

.json_viewer {
	width: 100%;
	height: 180px;
	max-height: 180px;

	box-shadow: 0 0 0 1px var(--gray-5);
	border-radius: 8px;
}

.disabled {
	cursor: default;
	pointer-events: none;
}

.notification_overlay {
	position: fixed;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	background-color: rgba(0, 0, 0, 0.4);
	z-index: 1000;
}

.notification_content {
	width: 90%;
	background-color: var(--card-bg);
	padding: 12px;
	border-radius: 8px;
	text-align: center;
	line-height: 1.2;
	box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
	z-index: 1001;
}
</style>
