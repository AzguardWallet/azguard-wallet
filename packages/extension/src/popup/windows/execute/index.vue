<script setup lang="ts">
/** Components */
import FeeSettingsCard from "../../components/modules/send/FeeSettingsCard.vue"
import NetworkBadge from "@/popup/components/modules/general/NetworkBadge.vue"

/** Vendor */
import { onMounted, onUnmounted } from "vue"

import { getErrorData, getErrorMessage } from "@/wallet/utils/errors"

/** Services */
import { type ProfileInfo, ProfileServiceClient } from "@/wallet/services/profile/client"
import { type Network, NetworkServiceClient } from "@/wallet/services/network/client"
import { type Account, AccountServiceClient } from "@/wallet/services/account/client"
import { ExecutionServiceClient, type FeeSettings, type Operation } from "@/wallet/services/execution/client"
import {
	type CaipAccount,
	type CaipChain,
	DappInteractionServiceClient,
	type ExecutionPayload,
} from "@/wallet/services/dapp-interaction/client"
import type { DappMetadata } from "@/wallet/services/dapp-session/client"
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
// @ts-expect-error
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

const feeEstimates = ref<Record<number, unknown>>({})
const estimatingOps = ref<Record<number, boolean>>({})
const estimateTimers: Record<number, ReturnType<typeof setTimeout>> = {}
const estimateCounters: Record<number, number> = {}
const executionService = new ExecutionServiceClient()

const startEstimation = (opIndex: number, op: UIOperation, feeSettings: FeeSettings) => {
	if (estimateTimers[opIndex]) clearTimeout(estimateTimers[opIndex])
	feeEstimates.value[opIndex] = null
	estimatingOps.value[opIndex] = true
	estimateCounters[opIndex] = (estimateCounters[opIndex] ?? 0) + 1
	const counter = estimateCounters[opIndex]

	estimateTimers[opIndex] = setTimeout(async () => {
		try {
			const result = await executionService.estimateOperationFee(op, feeSettings)
			if (counter !== estimateCounters[opIndex]) return
			feeEstimates.value[opIndex] = result
		} catch (err) {
			console.error("[Execute] Fee estimation failed:", err)
			if (counter !== estimateCounters[opIndex]) return
			feeEstimates.value[opIndex] = null
		} finally {
			if (counter === estimateCounters[opIndex]) {
				estimatingOps.value[opIndex] = false
			}
		}
	}, 500)
}

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
			return networks.find((x) => x.isDefault) ?? networks[0]
		}

		const getNetworkAndAccount = async (caipAccount: CaipAccount): Promise<[Network, Account]> => {
			const [_, chainId, address] = caipAccount.split(":")
			const networks = await networkService.getNetworks(+chainId)
			if (networks.length === 0) {
				throw new Error("Network no longer exists")
			}
			const network = networks.find((x) => x.isDefault) ?? networks[0]
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
				case "get_complete_address":
				case "register_token":
				case "simulate_transaction":
				case "simulate_utility":
				case "simulate_views":
				case "aztec_simulateTx":
				case "aztec_executeUtility":
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
					if (!_accounts.find((x) => x.address === account.address && x.chainId === account.chainId)) {
						_accounts.push(account)
					}
					break
				}
				case "aztec_sendTx": {
					const [network, account] = await getNetworkAndAccount(op.account)
					const isNoFrom = op.executionMode === "default_entrypoint"
					_operations.push({
						...op,
						network,
						networkId: network.id,
						account,
						accountAddress: account.address,
						feeSettings: isNoFrom || op.exec.feePayer !== undefined ? { paymentMethod: { kind: "embedded" } } : undefined!,
					})
					if (!_accounts.find((x) => x.address === account.address && x.chainId === account.chainId)) {
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
						feeSettings: op.fee?.embeddedFeePayment !== undefined ? { paymentMethod: { kind: "embedded" } } : undefined!,
					})
					if (!_accounts.find((x) => x.address === account.address && x.chainId === account.chainId)) {
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
	if (isInteractionCancelled.value || isLoading.value) return
	if (operations.value.find((x) => x.kind === "send_transaction" && !x.feeSettings)) {
		setError("Validation error", "You must specify fee payment method for each 'Send transaction' operations", "warning")
		return
	}
	try {
		isLoading.value = true
		await interactionService.approveInteraction(requestId.value!, operations.value, {
			type: OriginType.DAPP,
			name: dapp.value?.name ?? "Unknown app",
		})
		closeWindow(true)
	} catch (error) {
		setError("Processing error.", getErrorMessage(error))
	} finally {
		isLoading.value = false
	}
}

const reject = async () => {
	// Guard against double-fire on the cancellation overlay path where
	// closeWindow() can trigger beforeunload -> reject() on an already
	// cancelled interaction. Also guard against init throwing before
	// requestId resolves.
	if (isInteractionCancelled.value || !requestId.value) return
	interactionService.rejectInteraction(requestId.value, "User rejected")
	closeWindow(true)
}

const closeWindow = (interactionCompleted: boolean) => {
	if (interactionCompleted) {
		window.removeEventListener("beforeunload", reject)
	}
	chrome.windows.getCurrent(undefined, (window) => {
		if (window.id) {
			chrome.windows.remove(window.id)
		}
	})
}

/** Anti-phishing: show the normalized hostname (not raw URL) and flag
 *  IDN / punycode so homograph attacks are visible. */
const dappHostname = computed(() => {
	if (!dapp.value?.url) return ""
	try {
		return new URL(dapp.value.url).hostname
	} catch {
		return dapp.value.url
	}
})
const hostnameHasNonAscii = computed(() => {
	const h = dappHostname.value
	for (const ch of h) {
		if (ch.charCodeAt(0) > 127) return true
	}
	return h.split(".").some((label) => label.startsWith("xn--"))
})

/** Anti-phishing: identity strip reflects the REAL signer(s), not the
 *  popup's active account. Multi-op payloads may target multiple
 *  accounts / chains; strip shows MULTIPLE in those cases. */
const signerAccounts = computed(() => {
	const seen = new Set<string>()
	const out: Account[] = []
	for (const op of operations.value) {
		if (!op.account) continue
		const key = `${op.network.chainId}:${op.account.address}`
		if (seen.has(key)) continue
		seen.add(key)
		out.push(op.account)
	}
	return out
})
const signerNetworks = computed(() => {
	const seen = new Set<number>()
	const out: Network[] = []
	for (const op of operations.value) {
		if (seen.has(op.network.chainId)) continue
		seen.add(op.network.chainId)
		out.push(op.network)
	}
	return out
})
const stripStatus = computed<"ready" | "loading" | "cancelled">(() => {
	if (isInteractionCancelled.value) return "cancelled"
	if (isLoading.value) return "loading"
	return "ready"
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

const profileService = new ProfileServiceClient()
profileService.onActiveProfileChanged.add(onActiveProfileChanged)

const interactionService = new DappInteractionServiceClient()
interactionService.onInteractionCancelled.add(onInteractionCancelled)

onMounted(async () => {
	profileService.connect()
	interactionService.connect()

	if (!appStore.isSessionChecked) {
		await new Promise<void>((resolve) => {
			const stop = watch(
				() => appStore.isSessionChecked,
				(checked) => {
					if (checked) {
						stop()
						resolve()
					}
				},
				{ immediate: true },
			)
		})
	}

	if (!appStore.isLogined) {
		appStore.pageAwaitingAuth = router.currentRoute.value.fullPath
		router.push({ path: "/popup/auth" })
		return
	}

	await init()
	window.addEventListener("beforeunload", reject)
})

onUnmounted(() => {
	profileService.disconnect()
	interactionService.disconnect()
	executionService.disconnect()
	for (const t of Object.values(estimateTimers)) clearTimeout(t)
	window.removeEventListener("beforeunload", reject)
})
</script>

<template>
	<Flex v-if="appStore.isLogined" direction="column" :class="$style.wrapper">
		<!-- Identity strip: anti-phishing trust anchor. Shows the REAL signer(s)
		     derived from payload operations, not the popup's active account. -->
		<Flex align="center" justify="between" gap="12" :class="$style.identity_strip">
			<Flex align="center" gap="8">
				<span :class="[$style.status_dot, $style[`status_${stripStatus}`]]" />
				<template v-if="signerAccounts.length === 1">
					<span :class="$style.identity_account">{{ signerAccounts[0].name }}</span>
					<span :class="$style.identity_sep">·</span>
					<span :class="$style.identity_network">{{ signerNetworks[0]?.name ?? "" }}</span>
				</template>
				<template v-else-if="signerAccounts.length > 1">
					<span :class="$style.identity_account">{{ signerAccounts.length }} accounts</span>
					<span :class="$style.identity_sep">·</span>
					<span :class="[$style.identity_network, $style.identity_warn]">MIXED</span>
				</template>
				<template v-else>
					<span :class="$style.identity_account">No signer</span>
				</template>
			</Flex>
			<span :class="$style.identity_brand">NULO</span>
		</Flex>

		<!-- dApp identity block: hostname dominant, normalized, IDN flagged -->
		<Flex align="center" gap="12" :class="$style.dapp_block">
			<div :class="$style.dapp_logo_wrapper">
				<Icon v-if="dapp?.loadingLogo" :loading="true" name="dapp" size="24" color="tertiary" />
				<img v-else-if="dapp?.logoBlobUrl" :src="dapp?.logoBlobUrl" :class="$style.dapp_logo" alt="" />
				<Icon v-else name="dapp" size="24" color="tertiary" />
			</div>

			<Flex direction="column" gap="4" wide :class="$style.dapp_info">
				<Flex align="center" gap="6">
					<span :class="$style.dapp_hostname">{{ dappHostname }}</span>
					<Tooltip v-if="hostnameHasNonAscii" position="start">
						<Icon name="warning" size="12" color="orange" />
						<template #content>
							<Text size="12" color="secondary" :style="{ lineHeight: '1.3' }">
								This hostname contains non-ASCII or punycoded characters. Verify carefully — some characters can imitate Latin letters.
							</Text>
						</template>
					</Tooltip>
				</Flex>
				<span v-if="dapp?.name" :class="$style.dapp_name">{{ dapp.name }}</span>
				<span :class="$style.dapp_action">wants to execute the following</span>
			</Flex>
		</Flex>

		<Flex direction="column" gap="16" :class="$style.sections">
			<Flex v-if="operations.length" direction="column" gap="10" wide>
				<Flex wide justify="between" align="center">
					<SectionLabel label="Requested operations" :count="operations.length" />
					<Icon @click="showJson" name="expand" size="16" color="tertiary" :class="$style.fullscreen_icon" />
				</Flex>

				<template v-for="(op, i) in operations" :key="i">
					<Flex v-if="op.kind === 'send_transaction'" direction="column" :class="$style.op_card">
						<Flex :class="$style.op_body" direction="column" wide>
							<Flex wide justify="between">
								<Text size="14" color="primary">{{ humanizeOperationKind(op.kind) }}</Text>
								<NetworkBadge :chainId="op.network.chainId" />
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
											<Text weight="600">{{ humanizeMethodName(action.kind === "call" ? action.method : (action.name ?? action.selector)) }}</Text>
											<Text color="secondary"> on </Text>
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
						<div :class="$style.op_divider" />
						<Flex
							v-if="op.fee?.embeddedFeePayment !== undefined"
							align="center"
							gap="8"
							wide
							:class="$style.op_fee_set"
						>
							<Icon name="check-circle" size="14" color="green" />
							<Text size="13" weight="500" color="secondary">
								Fee payment method set by <Text size="13" weight="600" color="primary">{{ dapp?.name ?? 'the app' }}</Text>
							</Text>
						</Flex>
						<FeeSettingsCard
							v-else
							embedded
							:profile="profile"
							:network="op.network"
							:account="op.account"
							:feeEstimate="feeEstimates[i]"
							:isEstimating="!!estimatingOps[i]"
							:modelValue="op.feeSettings"
							@update:modelValue="
								($event?: FeeSettings) => {
									op.feeSettings = $event!
									clearError()
									if ($event) startEstimation(i, op, $event)
								}
							"
						/>
					</Flex>
					<Flex v-else-if="op.kind === 'aztec_sendTx'" direction="column" :class="$style.op_card">
						<Flex :class="$style.op_body" direction="column" wide>
							<Flex wide justify="between">
								<Text size="14" color="primary">{{ humanizeOperationKind(op.kind) }}</Text>
								<NetworkBadge :chainId="op.network.chainId" />
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
										<Text weight="600">{{ humanizeMethodName(call.name ?? call.selector) }}</Text>

										<Text color="secondary"> on </Text>
										<AddressDisplay :address="call.to" />
									</Text>
								</Flex>
							</Flex>
						</Flex>
						<div :class="$style.op_divider" />
						<Flex
							v-if="op.executionMode === 'default_entrypoint' || op.exec?.feePayer !== undefined"
							align="center"
							gap="8"
							wide
							:class="$style.op_fee_set"
						>
							<Icon name="check-circle" size="14" color="green" />
							<Text size="13" weight="500" color="secondary">
								Fee payment method set by <Text size="13" weight="600" color="primary">{{ dapp?.name ?? 'the app' }}</Text>
							</Text>
						</Flex>
						<FeeSettingsCard
							v-else
							embedded
							:profile="profile"
							:network="op.network"
							:account="op.account"
							:feeEstimate="feeEstimates[i]"
							:isEstimating="!!estimatingOps[i]"
							:modelValue="op.feeSettings"
							@update:modelValue="
								($event?: FeeSettings) => {
									op.feeSettings = $event!
									clearError()
									if ($event) startEstimation(i, op, $event)
								}
							"
						/>
					</Flex>
					<Flex v-else :class="[$style.op_card, $style.op_card_simple]" direction="column" wide>
						<Flex wide justify="between">
							<Text size="14" color="primary">{{ humanizeOperationKind(op.kind) }}</Text>
							<NetworkBadge :chainId="op.network.chainId" />
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
											<Text weight="600">{{ humanizeMethodName(action.kind === "call" ? action.method : (action.name ?? action.selector)) }}</Text>
											
											<Text color="secondary"> on </Text>
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
						</template>
						<template v-else-if="op.kind === 'simulate_utility'">
							<Flex :class="$style.prop">
								<Text size="12" color="secondary">Contract address:</Text>
								<AddressDisplay :address="op.contract" />
								<!-- <Text size="12" color="primary">{{ trimAddress(op.contract) }}</Text> -->
							</Flex>
							<Flex :class="$style.prop">
								<Text size="12" color="secondary">Function:</Text>
								<Text size="12" weight="600" color="primary">{{ humanizeMethodName(op.method) }}</Text>
							</Flex>
						</template>
						<template v-else-if="op.kind === 'simulate_views'">
							<Flex :class="$style.prop">
								<Text size="12" color="secondary">View calls:</Text>
								<Flex direction="column" gap="4">
									<Text v-for="(call, j) in op.calls" :key="`${i}:${j}`" size="12" color="primary">
										<Text weight="600">{{ humanizeMethodName(call.kind === "call" ? call.method : call.selector) }}</Text>
										<Text color="secondary"> on </Text>
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
										<Text weight="600">{{ humanizeMethodName(call.name ?? call.selector) }}</Text>
										
										<Text color="secondary"> on </Text>
										<AddressDisplay :address="call.to" />
									</Text>
								</Flex>
							</Flex>
						</template>
						<template v-else-if="op.kind === 'aztec_executeUtility'">
							<Flex :class="$style.prop">
								<Text size="12" color="secondary">Contract address:</Text>
								<AddressDisplay :address="op.call.to.toString()" />
							</Flex>
							<Flex :class="$style.prop">
								<Text size="12" color="secondary">Function:</Text>
								<Text size="12" weight="600" color="primary">{{ humanizeMethodName(op.call.name ?? op.call.selector.toString()) }}</Text>
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
										<Text weight="600">{{ humanizeMethodName(call.name ?? call.selector) }}</Text>

										<Text color="secondary"> on </Text>
										<AddressDisplay :address="call.to" />
									</Text>
								</Flex>
							</Flex>
						</template>
						<template v-else-if="op.kind === 'aztec_registerContract'">
							<Flex :class="$style.prop">
								<Text size="12" color="secondary">Contract address:</Text>
								<AddressDisplay :address="op.instance.address.toString()" />
							</Flex>
							<Flex v-if="op.artifact" :class="$style.prop">
								<Text size="12" color="secondary">Artifact:</Text>
								<Text size="12" color="primary">{{ op.artifact.name ?? "(custom)" }}</Text>
							</Flex>
						</template>
						<template v-else-if="op.kind === 'aztec_createAuthWit'">
							<Flex :class="$style.prop">
								<Text size="12" color="secondary">Message type:</Text>
								<Text size="12" weight="600" color="primary">
									{{ (op.messageHashOrIntent as { innerHash?: unknown }).innerHash !== undefined ? "Inner hash" : "Call intent" }}
								</Text>
							</Flex>
							<template v-if="(op.messageHashOrIntent as { call?: { to: unknown; name?: string; selector?: unknown } }).call">
								<Flex :class="$style.prop">
									<Text size="12" color="secondary">Target contract:</Text>
									<AddressDisplay :address="(op.messageHashOrIntent as { call: { to: { toString(): string } } }).call.to.toString()" />
								</Flex>
								<Flex :class="$style.prop">
									<Text size="12" color="secondary">Function:</Text>
									<Text size="12" weight="600" color="primary">
										{{ humanizeMethodName((op.messageHashOrIntent as { call: { name?: string; selector?: { toString(): string } } }).call.name ?? (op.messageHashOrIntent as { call: { selector?: { toString(): string } } }).call.selector?.toString() ?? "") }}
									</Text>
								</Flex>
							</template>
						</template>
					</Flex>
				</template>
			</Flex>
		</Flex>

		<Flex direction="column" gap="10" :class="$style.footer">
			<Tooltip v-if="processingError" side="top" position="start" :disabled="!processingError.tooltip">
				<Flex align="center" wide gap="6">
					<Icon name="info" size="14" :color="processingError.type === 'warning' ? 'orange' : 'red'" />
					<Text size="12" weight="600" color="secondary">{{ processingError.title }}</Text>
				</Flex>

				<template #content>
					<Text size="12" color="secondary">{{ processingError.tooltip }}</Text>
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
					:disabled="processingError?.type === 'error'"
				>
					<Text size="13" color="inverse">{{ isLoading ? "Executing" : "Confirm" }}</Text>
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

	display: flex;
	flex-direction: column;

	background: var(--app-bg);
	border-top: 2px solid var(--nulo-accent);
}

/* ── Identity strip ────────────────────────────────────────────── */

.identity_strip {
	flex-shrink: 0;

	padding: 10px 16px;
	background: var(--nulo-surface);
	border-bottom: 1px solid var(--nulo-border);
}

.status_dot {
	display: inline-block;
	width: 6px;
	height: 6px;
	flex-shrink: 0;
}

.status_ready { background: var(--green); }
.status_loading { background: var(--orange); }
.status_cancelled { background: var(--red); }

.identity_account {
	font-family: var(--font-headline);
	font-size: 11px;
	font-weight: 700;
	letter-spacing: 0.05em;
	text-transform: uppercase;
	color: var(--txt-primary);

	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	max-width: 140px;
}

.identity_sep {
	font-family: var(--font-mono);
	font-size: 11px;
	color: var(--nulo-outline);
}

.identity_network {
	font-family: var(--font-mono);
	font-size: 10px;
	color: var(--nulo-secondary);

	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	max-width: 80px;
}

.identity_warn {
	color: var(--orange);
	font-weight: 700;
}

.identity_brand {
	font-family: var(--font-headline);
	font-size: 10px;
	font-weight: 700;
	letter-spacing: 0.2em;
	color: var(--nulo-outline);
}

/* ── dApp identity block ───────────────────────────────────────── */

.dapp_block {
	flex-shrink: 0;

	padding: 16px;
	border-bottom: 1px solid var(--nulo-border);
}

.dapp_logo_wrapper {
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;

	width: 40px;
	height: 40px;

	background: var(--nulo-surface);
	border: 1px solid var(--nulo-border);
}

.dapp_logo {
	width: 40px;
	height: 40px;
	object-fit: cover;
}

.dapp_info {
	min-width: 0;
}

.dapp_hostname {
	font-family: var(--font-headline);
	font-size: 14px;
	font-weight: 700;
	letter-spacing: 0.01em;
	color: var(--txt-primary);

	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.dapp_name {
	font-family: var(--font-mono);
	font-size: 11px;
	color: var(--nulo-secondary);

	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.dapp_action {
	font-family: var(--font-body);
	font-size: 12px;
	color: var(--nulo-secondary);
}

/* ── Sections ──────────────────────────────────────────────────── */

.sections {
	padding: 16px;
}

/* ── Operation cards ───────────────────────────────────────────── */

.op_card {
	width: 100%;

	border: 1px solid var(--nulo-border);
	background: transparent;
	overflow: hidden;
}

.op_card_simple {
	padding: 12px;
}

.op_body {
	padding: 12px;
}

.op_divider {
	height: 1px;
	background: var(--nulo-border);
}

.op_fee_set {
	padding: 12px;
	background: var(--nulo-surface-low);
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
	padding: 4px;

	&:hover {
		background: var(--nulo-surface-high);
	}
}

/* ── Footer ────────────────────────────────────────────────────── */

.footer {
	flex-shrink: 0;

	margin-top: auto;
	padding: 16px;
	border-top: 1px solid var(--nulo-border);
	background: var(--nulo-surface);
}

/* ── Overlays ──────────────────────────────────────────────────── */

.notification_overlay {
	position: fixed;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	background: rgba(10, 9, 8, 0.8);
	z-index: 1000;
}

.notification_content {
	width: 90%;

	padding: 16px;
	background: var(--nulo-surface);
	border: 1px solid var(--nulo-border);

	text-align: center;
	line-height: 1.2;
	z-index: 1001;
}
</style>
