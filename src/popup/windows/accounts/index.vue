<script setup lang="ts">
/** Vendor */
import { onMounted, onUnmounted } from "vue"

/** Components */
// @ts-ignore
import NetworkBadge from "@/popup/components/modules/general/NetworkBadge.vue"

/** Utils */
import { getErrorData } from "@/wallet/utils/errors"

/** Services */
import { ProfileInfo, ProfileServiceClient } from "@/wallet/services/profile/client"
import { Network, NetworkServiceClient } from "@/wallet/services/network/client"
import { Account, AccountServiceClient } from "@/wallet/services/account/client"
import { DappSessionServiceClient, type DappSession } from "@/wallet/services/dapp-session/client"
import {
	AccountAuthPayload,
	DappInteractionServiceClient,
} from "@/wallet/services/dapp-interaction/client"

type UIError = {
	title: string
	tooltip: string
	type: string
}

/** Store */
import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()

const router = useRouter()

const profile = ref<ProfileInfo>()
const requestId = ref<string>()
const payload = ref<AccountAuthPayload>()
const dappSession = ref<DappSession>()

const accounts = ref<Account[]>([])
const selectedAccounts = ref<Account[]>([])
const accountAliases = ref<Record<string, string>>({})

const isLoading = ref(false)
const isInteractionCancelled = ref(false)
const processingError = ref<UIError>()

const initRequest = async () => {
	try {
		profile.value = await profileService.getActiveProfile()
		requestId.value = router.currentRoute.value.query.requestId?.toString()
		if (!requestId.value) {
			throw new Error("Invalid interaction request id")
		}
		payload.value = (await interactionService.getInteractionPayload(requestId.value)) as AccountAuthPayload
		dappSession.value = payload.value.session
	} catch (error) {
		console.error(getErrorData(error))
		setError("Something went wrong")
	}
}

const initAccounts = async () => {
	if (!profile.value || !payload.value) return
	const chainId = payload.value.params.chainId
	const accountClient = new AccountServiceClient()
	const _accounts = await accountClient.getAccounts(profile.value.id, chainId, true)
	accounts.value = _accounts.toSorted((a, b) => a.index - b.index)
}

function setError(title: string, tooltip: string = title, type: string = "error") {
	processingError.value = { title, tooltip, type }
}

function clearError() {
	processingError.value = undefined
}

const selectAccount = (account: Account) => {
	if (processingError.value?.type === "warning") {
		clearError()
	}
	const index = selectedAccounts.value.findIndex(acc => acc.address === account.address)
	if (index < 0) {
		selectedAccounts.value.push(account)
	} else {
		selectedAccounts.value.splice(index, 1)
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
	if (selectedAccounts.value.length === 0) {
		setError(
			"Select at least one account",
			"You must select at least one account to share with the dApp",
			"warning",
		)
		return
	}
	try {
		isLoading.value = true
		const chainId = payload.value!.params.chainId
		const caipAccounts = selectedAccounts.value.map(acc => `aztec:${chainId}:${acc.address}`)

		const aliases: Record<string, string> = {}
		for (const acc of selectedAccounts.value) {
			const caip = `aztec:${chainId}:${acc.address}`
			aliases[caip] = accountAliases.value[caip] || acc.name
		}

		await interactionService.resolveInteraction(requestId.value!, {
			accounts: caipAccounts,
			aliases,
		})
		closeWindow(true)
	} catch (error) {
		console.error(getErrorData(error))
		setError("Something went wrong")
	} finally {
		isLoading.value = false
	}
}

const reject = async () => {
	interactionService.rejectInteraction(requestId.value!, "User rejected")
	closeWindow(true)
}

const closeWindow = (interactionCompleted?: boolean) => {
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

const sessionService = new DappSessionServiceClient()

const interactionService = new DappInteractionServiceClient()
interactionService.onInteractionCancelled.add(onInteractionCancelled)

onMounted(async () => {
	profileService.connect()
	sessionService.connect()
	interactionService.connect()

	if (!appStore.isSessionChecked) {
		await new Promise<void>((resolve) => {
			const stop = watch(() => appStore.isSessionChecked, (checked) => {
				if (checked) { stop(); resolve() }
			}, { immediate: true })
		})
	}

	if (!appStore.isLogined) {
		appStore.pageAwaitingAuth = router.currentRoute.value.fullPath
		router.push({ path: "/popup/auth" })
		return
	}

	await initRequest()
	await initAccounts()
	window.addEventListener("beforeunload", reject)
})

onUnmounted(() => {
	profileService.disconnect()
	sessionService.disconnect()
	interactionService.disconnect()
	window.removeEventListener("beforeunload", reject)
})
</script>

<template>
	<Flex v-if="appStore.isLogined" direction="column" justify="between" :class="$style.wrapper">
		<Flex direction="column" gap="16">
			<Flex align="center" justify="center" gap="8" :style="{ paddingTop: '8px' }">
				<Text size="16" weight="600" color="primary">Share accounts</Text>
			</Flex>

			<Flex direction="column" align="center" justify="center" gap="8" :style="{ marginTop: '-4px' }">
				<Flex direction="column" align="center" justify="center" gap="4">
					<Text size="13" weight="600" color="primary">
						{{ dappSession?.dappMetadata.name ?? "Unknown DApp" }}
					</Text>
					<Text size="12" weight="600" color="tertiary">
						{{ dappSession?.dappMetadata.url }}
					</Text>
				</Flex>
				<Text size="13" color="primary">wants to see your accounts</Text>
				<Text size="12" color="secondary">Select which accounts to share with this dApp</Text>
			</Flex>

			<Flex
				v-if="accounts.length"
				direction="column"
				align="start"
				justify="start"
				gap="12"
				:class="$style.accounts_section"
			>
				<Flex direction="column" align="start" justify="start" gap="4">
					<Text size="15" weight="600" color="primary">Select accounts</Text>
				</Flex>
				<Flex direction="column" align="start" justify="start" gap="6" :class="$style.accounts">
					<Flex
						v-for="acc in accounts"
						direction="column"
						gap="8"
						:class="[$style.account, (isLoading || processingError?.type === 'error') && $style.disabled]"
					>
						<Flex @click="selectAccount(acc)" gap="10" style="cursor: pointer">
							<Flex align="center">
								<Icon
									v-if="selectedAccounts?.find(a => a.address === acc.address)"
									name="check-circle"
									size="16"
									color="green"
								/>
								<Icon v-else name="circle" size="16" color="secondary" />
							</Flex>

							<Flex direction="column" gap="4" wide>
								<Flex align="center" justify="between" gap="12">
									<Text size="14" weight="600" color="primary">
										{{ acc.name }}
									</Text>

									<NetworkBadge :chainId="acc.chainId" />
								</Flex>
								<Text size="13" weight="600" color="tertiary">
									{{ `${acc.address.slice(0, 6)}...${acc.address.slice(-4)}` }}
								</Text>
							</Flex>
						</Flex>
						<Flex
							v-if="selectedAccounts?.find(a => a.address === acc.address)"
							direction="column"
							gap="4"
							wide
						>
							<Flex align="center" gap="4">
								<Text size="12" weight="600" color="secondary">Alias</Text>
								<Tooltip position="start">
									<Icon name="info" size="11" color="tertiary" />
									<template #content>
										<Text size="12" color="secondary" :style="{ lineHeight: '1.2' }">
											A private name for this account visible only to this app
										</Text>
									</template>
								</Tooltip>
							</Flex>
							<input
								:value="accountAliases[`aztec:${payload?.params.chainId}:${acc.address}`] ?? acc.name"
								@input="accountAliases[`aztec:${payload?.params.chainId}:${acc.address}`] = ($event.target as HTMLInputElement).value"
								:class="$style.alias_input"
								:placeholder="acc.name"
							/>
						</Flex>
					</Flex>
				</Flex>
			</Flex>
		</Flex>

		<Flex direction="column" gap="10" style="margin-top: 16px">
			<Tooltip v-if="processingError" side="top" position="start" wide :disabled="!processingError.tooltip">
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
					:disabled="!selectedAccounts.length || processingError"
				>
					<Text size="13" color="inverse">Approve</Text>
				</Button>
			</Flex>
		</Flex>

		<Flex v-if="isInteractionCancelled" align="center" justify="center" :class="$style.notification_overlay">
			<Flex direction="column" align="center" gap="16" :class="$style.notification_content">
				<Text size="13" weight="600" color="primary">Account request was cancelled</Text>

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

	padding: 10px 24px 12px 24px;
}

.accounts_section {
	width: 100%;
}

.accounts {
	width: 100%;
	max-height: 280px;
	overflow: auto;
}

.account {
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

.alias_input {
	width: 100%;
	padding: 6px 10px;
	border-radius: 8px;
	border: 1px solid var(--gray-10);
	background: var(--gray-3);
	color: var(--txt-primary);
	font-size: 13px;
	font-family: inherit;
	outline: none;
	transition: border-color 0.2s ease;

	&:focus {
		border-color: var(--blue);
	}

	&::placeholder {
		color: var(--txt-tertiary);
	}
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
