<route lang="json">
{
	"meta": {
		"isAuthRequired": true
	}
}
</route>

<script setup>
/** Components */
import AmountCard from "@/popup/components/modules/send/AmountCard.vue"
import FeeSettingsCard from "@/popup/components/modules/send/FeeSettingsCard.vue"
import SelectTokenCard from "@/popup/components/modules/send/SelectTokenCard.vue"
import SendTypesCard from "@/popup/components/modules/send/SendTypesCard.vue"

/** Services */
import { ContactServiceClient } from "@/wallet/services/contact/client"
import { ExecutionServiceClient } from "@/wallet/services/execution/client"
import { TokenBalanceServiceClient } from "@/wallet/services/token-balance/client"
import { TokenServiceClient } from "@/wallet/services/token/client"
import { TransferType } from "@/wallet/services/transaction/client"

/** Vendor */
import BN from "bignumber.js"

/** Utils */
import { isValidHex, trimAddress } from "@/utils/string"

/** Composables */
import { useToast } from "@/composables/toast.js"
const { openToast } = useToast()

/** Store */
import { useAppStore } from "@/stores/app.store"
import { useCacheStore } from "@/stores/cache.store"
const appStore = useAppStore()
const cacheStore = useCacheStore()

const route = useRoute()
const router = useRouter()

/** Post-send / forced-close navigation. Prefers browser history so the user
 *  returns to whichever surface launched Send (token detail, contacts, home);
 *  falls back to /popup/general for cold-open / deep-link. */
function leaveSend() {
	if (window.history.length > 1) {
		router.back()
	} else {
		router.replace("/popup/general")
	}
}

const feeSettings = ref()

const awaitingNewToken = ref(false)

const tokenService = new TokenServiceClient()
tokenService.onTokenAdded.add(onTokenAdded)
tokenService.onTokenDeleted.add(onTokenDeleted)
function onTokenAdded(token) {
	tokens.value.push(token)
}
function onTokenDeleted(token) {
	const idx = tokens.value.findIndex((t) => t.id === token.id)
	if (idx === -1) return

	tokens.value.splice(idx, 1)

	if (activeToken.value?.id !== token.id) return

	if (tokens.value?.length) {
		cacheStore.activeTokenIdx = tokens.value[0].id
		return
	}

	openToast({ label: "The last token has just been deleted" })

	leaveSend()
}

const tokens = ref([])
const activeToken = computed(() => tokens.value?.find((t) => t.id === cacheStore.activeTokenIdx))
const isBlockedTransfer = computed(() => !activeToken.value?.hasPrivateTransfers && !activeToken.value?.hasPublicTransfers)

const tokenBalanceService = new TokenBalanceServiceClient()
tokenBalanceService.onTokenBalanceAdded.add(onBalanceAdded)
tokenBalanceService.onTokenBalanceUpdated.add(onBalanceUpdated)
function onBalanceAdded(balance) {
	if (balance.account !== appStore.account.address) return

	tokenBalance.push(balance)
}
function onBalanceUpdated(balance) {
	const idx = tokenBalances.value.findIndex((tb) => tb.id === balance.id)
	if (idx === -1) return

	tokenBalances.value[idx] = balance
}

const tokenBalances = ref([])
const tokenBalance = computed(() => {
	return tokenBalances.value?.find((b) => b?.token.id === cacheStore.activeTokenIdx)
})
const tokenBalanceByType = computed(() => {
	if (!tokenBalance.value) return 0
	return selectedSendType.value === "private"
		? tokenBalance.value.privateBalance / 10 ** activeToken.value.decimals
		: tokenBalance.value.publicBalance / 10 ** activeToken.value.decimals
})

const selectedSendType = ref("private")
const selectedReceiverType = ref("private")
const initSendType = () => {
	if (!activeToken.value) return
	if (cacheStore.preselectedBalanceType && activeToken.value.hasPrivateTransfers && activeToken.value.hasPublicTransfers) {
		selectedSendType.value = cacheStore.preselectedBalanceType
	}

	if (!activeToken.value.hasPrivateTransfers) {
		selectedSendType.value = "public"
	}

	if (!activeToken.value.hasPublicTransfers) {
		selectedSendType.value = "private"
	}
}
const initReceiverType = () => {
	if (!activeToken.value) return
	if (cacheStore.preselectedBalanceType && activeToken.value.hasPrivateBalances && activeToken.value.hasPublicBalances) {
		selectedReceiverType.value = cacheStore.preselectedBalanceType
	}

	if (!activeToken.value.hasPrivateTransfers) {
		selectedReceiverType.value = "public"
	}

	if (!activeToken.value.hasPublicTransfers) {
		selectedReceiverType.value = "private"
	}
}

const contactService = new ContactServiceClient()
contactService.onContactAdded.add(onContactAdded)
contactService.onContactUpdated.add(onContactUpdated)
contactService.onContactDeleted.add(onContactDeleted)
function onContactAdded(contact) {
	contacts.value.push(contact)
}
function onContactUpdated(contact) {
	const idx = contacts.value.findIndex((c) => c.id === contact.id)
	if (idx !== -1) {
		contacts.value[idx] = contact
	} else {
		contacts.value.push(contact)
	}
}
function onContactDeleted(contact) {
	contacts.value = contacts.value.filter((c) => c.id !== contact.id)
}

const contacts = ref([])
const selectedContact = ref()
const searchTerm = ref("")
const isSearchInputFocused = ref(false)
const filteredContacts = computed(() => {
	if (!searchTerm.value) return []

	const lowTerm = searchTerm.value?.toLowerCase() || ""

	return [...contacts.value, ...appStore.accounts]?.filter((c) => {
		return c.name?.toLowerCase().includes(lowTerm) || c.address === searchTerm.value || c.abbr?.toLowerCase() === lowTerm
	})
})
const showSuggestions = computed(() => {
	return filteredContacts.value?.length && isSearchInputFocused.value
})

function handleSearchBlur() {
	if (searchTerm.value !== selectedContact.value?.address) {
		const contact = [...contacts.value, ...appStore.accounts].find((c) => c.address === searchTerm.value)
		if (contact) {
			handleSelectContact(contact)
		}
	}

	setTimeout(() => {
		isSearchInputFocused.value = false
	}, 250)
}
function handleSelectContact(contact) {
	selectedContact.value = contact
	searchTerm.value = contact.address
}

const amountTerm = ref()

const isValidAddress = computed(() => isValidHex(searchTerm.value))
const isAllowedToSend = computed(() => {
	if (!amountTerm.value) return

	const amountToSend = new BN(typeof amountTerm.value === "string" ? amountTerm.value?.replace(",", "") : amountTerm.value)

	if (!tokenBalanceByType.value) return
	if (isBlockedTransfer.value) return
	if (Number.isNaN(amountToSend)) return
	if (amountToSend < 0.00000001) return
	if (!amountToSend) return
	if (!isValidAddress.value) return
	if (amountToSend > tokenBalanceByType.value) return
	if (!feeSettings.value) return

	return true
})

const transferType = computed(() => {
	if (selectedSendType.value === "private" && selectedReceiverType.value === "private") return TransferType.Private
	if (selectedSendType.value === "private" && selectedReceiverType.value === "public") return TransferType.PrivateToPublic
	if (selectedSendType.value === "public" && selectedReceiverType.value === "private") return TransferType.PublicToPrivate
	if (selectedSendType.value === "public" && selectedReceiverType.value === "public") return TransferType.Public
	return undefined
})

const feeEstimate = ref(null)
const isEstimating = ref(false)
let estimateTimer = null
let estimateCounter = 0

const executionService = new ExecutionServiceClient()
const isSending = ref(false)
const handleSend = async () => {
	if (!isAllowedToSend.value || isSending.value) return

	isSending.value = true

	const amountToSend = new BN(amountTerm.value?.trim().replace(",", "")).times(10 ** activeToken.value.decimals)

	appStore.awaitingTransactions.push({
		account: appStore.account.address,
		destination: searchTerm.value,
		contract: activeToken.value.contract,
	})

	try {
		await executionService.executeTransfer(
			appStore.network.id,
			appStore.account.address,
			activeToken.value.id,
			transferType.value,
			searchTerm.value,
			amountToSend,
			feeSettings.value,
		)
		openToast({ label: "Transaction submitted", icon: "check-circle" })
		leaveSend()
	} catch (err) {
		const idx = appStore.awaitingTransactions.findIndex(
			(t) => t.destination === searchTerm.value && t.contract === activeToken.value.contract,
		)
		if (idx !== -1) appStore.awaitingTransactions.splice(idx, 1)

		openToast({ label: "Simulation failed, transaction not sent", icon: "warning", color: "red" }, TOAST_DURATION.LONG)
		console.error("[send] executeTransfer failed:", err)
	} finally {
		isSending.value = false
		executionService.disconnect()
	}
}

watch(
	() => cacheStore.activeTokenIdx,
	() => {
		initSendType()
		initReceiverType()

		amountTerm.value = null
	},
)

watch(
	() => tokens.value,
	() => {
		if (tokens.value?.length && awaitingNewToken.value) {
			awaitingNewToken.value = false
			cacheStore.activeTokenIdx = tokens.value[0].id
		}
	},
	{ deep: true },
)

watch(
	() => searchTerm.value,
	(newVal) => {
		if (selectedContact.value && newVal !== selectedContact.value.address) {
			selectedContact.value = null
		}
	},
)

watch(
	[amountTerm, searchTerm, selectedSendType, selectedReceiverType, () => feeSettings.value],
	() => {
		if (estimateTimer) clearTimeout(estimateTimer)
		feeEstimate.value = null

		// NB: transferType can be 0 (TransferType.Private enum) which is falsy — check against undefined explicitly
		// or Private → Private is silently dropped here before estimation.
		if (!amountTerm.value || !isValidAddress.value || transferType.value === undefined || !feeSettings.value || !activeToken.value) {
			isEstimating.value = false
			return
		}

		isEstimating.value = true
		const counter = ++estimateCounter

		estimateTimer = setTimeout(async () => {
			try {
				const amountToEstimate = new BN(
					typeof amountTerm.value === "string" ? amountTerm.value?.replace(",", "") : amountTerm.value,
				).times(10 ** activeToken.value.decimals)

				if (amountToEstimate.isNaN() || amountToEstimate.lte(0)) {
					isEstimating.value = false
					return
				}

				const result = await executionService.estimateTransferFee(
					appStore.network.id,
					appStore.account.address,
					activeToken.value.id,
					transferType.value,
					searchTerm.value,
					amountToEstimate,
					feeSettings.value,
				)

				if (counter !== estimateCounter) return
				feeEstimate.value = result
			} catch (err) {
				if (counter !== estimateCounter) return
				console.error("[send] estimateTransferFee failed:", err)
				feeEstimate.value = null
			} finally {
				if (counter === estimateCounter) {
					isEstimating.value = false
				}
			}
		}, 800)
	},
	{ deep: true },
)

const onKeydown = (e) => {
	if (e.key === "Enter") {
		if (showSuggestions.value) {
			handleSelectContact(filteredContacts.value[0])
			document.activeElement?.blur()
		}
	}
}

onMounted(async () => {
	tokens.value = await tokenService.getTokens(appStore.profile.id, appStore.network.chainId)
	tokenBalances.value = await tokenBalanceService.getTokenBalances(undefined, appStore.account.address)
	contacts.value = await contactService.getContacts()

	// Query-param preselect survives the unmount of tokens/[id] (which clears
	// cacheStore.activeTokenIdx on its onBeforeUnmount). Falls through to
	// whatever activeTokenIdx may still be set, then to tokens[0].
	const queryTokenId = route.query.tokenId ? Number(route.query.tokenId) : null
	if (queryTokenId && tokens.value.some((t) => t.id === queryTokenId)) {
		cacheStore.activeTokenIdx = queryTokenId
	}

	if (!cacheStore.activeTokenIdx && tokens.value.length) {
		cacheStore.activeTokenIdx = tokens.value[0].id
	}

	initSendType()
	initReceiverType()

	if (cacheStore.preselectedContactToSend) {
		handleSelectContact(cacheStore.preselectedContactToSend)
	}

	if (!tokens.value.length) {
		awaitingNewToken.value = true
	}

	document.addEventListener("keydown", onKeydown)
})

onBeforeUnmount(() => {
	contactService.disconnect()
	tokenBalanceService.disconnect()
	tokenService.disconnect()

	if (estimateTimer) clearTimeout(estimateTimer)
	feeEstimate.value = null
	isEstimating.value = false
	estimateCounter++

	amountTerm.value = null

	searchTerm.value = ""
	isSearchInputFocused.value = false

	contacts.value = []
	selectedContact.value = null

	awaitingNewToken.value = false

	cacheStore.preselectedBalanceType = "private"
	cacheStore.preselectedContactToSend = null

	document.removeEventListener("keydown", onKeydown)
})
</script>

<template>
	<Flex direction="column" :class="$style.wrapper">
		<SubPageHeader title="Send" :backTo="'/popup/general'" />

		<Flex wide direction="column" justify="between" :class="$style.body">
			<Flex direction="column" :class="$style.top">
				<!-- Section: Transfer Path + Recipient — flush variant: the input's own bottom border
				     is the visual terminator, so we suppress the section divider to avoid a double line. -->
				<div :class="[$style.section, $style.section_flush]">
					<SendTypesCard
						v-if="!isBlockedTransfer"
						v-model:sendType="selectedSendType"
						v-model:receiverType="selectedReceiverType"
						:token="activeToken"
					/>

					<div :class="$style.recipient_section">
						<span :class="$style.section_label">Recipient Address</span>
						<div :class="$style.recipient_input_wrapper" data-testid="send-destination-field" :style="{ position: 'relative' }">
							<input
								v-model="searchTerm"
								@focus="isSearchInputFocused = true"
								@blur="handleSearchBlur()"
								placeholder="0x... or contact name"
								:class="$style.recipient_input"
							/>
							<Flex v-if="selectedContact" align="center" gap="6" :class="$style.input_right">
								<Icon name="vault" size="12" color="blue" />
								<Text size="13" weight="600" color="primary" noWrap>
									{{ selectedContact?.name }}
								</Text>
							</Flex>
							<Flex v-else-if="!isSearchInputFocused && !isValidAddress && searchTerm.length > 0" align="center" gap="6" :class="$style.input_right">
								<Icon name="warning" size="12" color="red" />
							</Flex>
							<Flex v-else-if="!isSearchInputFocused && isValidAddress" align="center" :class="$style.input_right">
								<Icon name="check-circle" size="14" color="green" />
							</Flex>

							<Transition name="fade">
								<Flex v-if="showSuggestions" align="center" direction="column" wide :class="$style.contacts_wrapper">
									<Flex
										v-for="c in filteredContacts"
										@click="handleSelectContact(c)"
										align="center"
										gap="10"
										:class="$style.contact"
										wide
									>
										<Flex v-if="c.abbr" align="center" justify="center" :class="$style.contact_avatar" :style="{ backgroundColor: `var(--${c.color})`}">
											<Text size="10" weight="600" color="primary">
												{{ c.abbr }}
											</Text>
										</Flex>
										<Flex v-else align="center" justify="center">
											<Icon name="vault" size="28" scale="1.2" color="secondary" />
										</Flex>

										<Flex direction="column" gap="4" wide>
											<Text size="14" weight="600" color="primary" :class="$style.title"> {{ c.name }} </Text>
											<Text size="12" weight="500" color="tertiary" :class="$style.description">
												{{ trimAddress(c.address) }}
											</Text>
										</Flex>
									</Flex>
								</Flex>
							</Transition>
						</div>
					</div>
				</div>

				<!-- Section: Select Asset -->
				<div :class="$style.section">
					<Flex align="center" justify="between">
						<span :class="$style.section_label">Select Asset</span>
						<span :class="$style.section_meta">Network: {{ getChainName(appStore.network?.chainId) }}</span>
					</Flex>
					<SelectTokenCard :token="activeToken" />
				</div>

				<!-- Section: Transaction Amount -->
				<div :class="$style.section">
					<span :class="$style.section_label">Transaction Amount</span>
					<AmountCard
						v-model="amountTerm"
						:selectedSendType
						:token="activeToken"
						:tokenBalanceByType
					/>
				</div>

				<!-- Section: Fee Summary -->
				<div :class="$style.section_last">
					<FeeSettingsCard
						:profile="appStore.profile"
						:network="appStore.network"
						:account="appStore.account"
						:feeEstimate="feeEstimate"
						:isEstimating="isEstimating"
						v-model="feeSettings"
					/>
				</div>
			</Flex>

			<Flex direction="column" :class="$style.bottom">
				<button
					@click="handleSend"
					data-testid="send-submit"
					:disabled="!isAllowedToSend || isSending"
					:class="$style.confirm_btn"
				>
					{{ isSending ? "Confirming..." : "Confirm Transaction" }}
				</button>
			</Flex>
		</Flex>
	</Flex>
</template>

<style module>
.wrapper {
	flex: 1;
	overflow: auto;
	scrollbar-gutter: stable;
	background: var(--app-bg);
}

.body {
	flex: 1;
}

.top {
	padding: 0 24px;
	overflow-y: auto;
}

.section {
	display: flex;
	flex-direction: column;
	gap: 8px;

	padding: 20px 0;
	border-bottom: 1px solid rgba(35, 31, 28, 1);
}

.section_flush {
	border-bottom: none;
}

.section_last {
	padding: 20px 0;
}

.section_label {
	font-family: var(--font-headline);
	font-size: 10px;
	font-weight: 700;
	text-transform: uppercase;
	letter-spacing: 0.1em;
	color: var(--nulo-secondary);
}

.section_meta {
	font-family: var(--font-mono);
	font-size: 10px;
	color: var(--nulo-secondary);
}

.recipient_section {
	display: flex;
	flex-direction: column;
	gap: 4px;
	margin-top: 8px;
}

.recipient_input_wrapper {
	display: flex;
	align-items: center;
	border-bottom: 1px solid #231f1c;
	padding: 12px 0;

	transition: border-color 0.2s var(--bezier);

	&:focus-within {
		border-color: var(--nulo-accent);
	}
}

.recipient_input {
	flex: 1;
	background: transparent;
	border: none;
	outline: none;
	padding: 0;

	font-family: var(--font-mono);
	font-size: 14px;
	color: var(--txt-primary);

	&::placeholder {
		color: #363433;
	}
}

.input_right {
	max-width: 50%;
	& span {
		max-width: 90%;
		min-width: 90%;

		text-overflow: ellipsis;
		overflow: hidden;
		white-space: nowrap;
	}
}

.contacts_wrapper {
	position: absolute;
	top: 100%;
	left: 0;
	right: 0;
	z-index: 999;

	border: 1px solid var(--nulo-outline);
	background: var(--nulo-surface-low);

	max-height: 150px;

	overflow-y: auto;

	.contact {
		cursor: pointer;

		padding: 8px 12px;
		transition: all 0.2s var(--bezier);

		&:hover {
			background: var(--nulo-surface-high);
		}

		&:active {
			background: var(--nulo-surface-highest);
		}

		.contact_avatar {
			width: 28px;
			height: 28px;
			border-radius: 50%;
			flex-shrink: 0;
		}

		.title {
			min-width: 100%;
			width: 0;

			line-height: 16px !important;

			text-overflow: ellipsis;
			overflow: hidden;
			white-space: nowrap;
		}

		.description {
			min-width: 100%;
			width: 0;

			line-height: 14px !important;

			text-overflow: ellipsis;
			overflow: hidden;
			white-space: nowrap;
		}
	}
}

.bottom {
	padding: 20px 24px;
}

.confirm_btn {
	width: 100%;

	background: var(--nulo-accent);
	color: #0a0908;

	font-family: var(--font-headline);
	font-weight: 700;
	font-size: 14px;
	letter-spacing: 0.2em;
	text-transform: uppercase;

	padding: 20px 0;
	cursor: pointer;

	transition: all 0.2s var(--bezier);

	&:hover {
		background: #fff;
	}

	&:active {
		transform: scale(0.98);
	}

	&:disabled {
		opacity: 0.3;
		pointer-events: none;
	}
}
</style>
