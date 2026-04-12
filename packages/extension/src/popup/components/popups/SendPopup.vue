<script setup>
/** Components */
import AmountCard from "../modules/send/AmountCard.vue"
import FeeSettingsCard from "../modules/send/FeeSettingsCard.vue"
import SelectTokenCard from "../modules/send/SelectTokenCard.vue"
import SendTypesCard from "../modules/send/SendTypesCard.vue"

/** Services */
import { ContactServiceClient } from "@/wallet/services/contact/client"
import { ExecutionServiceClient } from "@/wallet/services/execution/client"
import { TokenBalanceServiceClient } from "@/wallet/services/token-balance/client"
import { TokenServiceClient } from "@/wallet/services/token/client"
import { TransferType } from "@/wallet/services/transaction/client"

/** Vendor */
import BN from "bignumber.js"

/** Utils */
import { capitalize, isValidHex } from "@/utils/string"

/** Composables */
import { useToast } from "@/composables/toast.js"
const { openToast } = useToast()

/** Store */
import { useAppStore } from "@/stores/app.store"
import { usePopupStore } from "@/stores/popup.store"
import { useCacheStore } from "@/stores/cache.store"
const appStore = useAppStore()
const popupStore = usePopupStore()
const cacheStore = useCacheStore()

const route = useRoute()

const emit = defineEmits(["onClose"])
const props = defineProps({
	show: Boolean,
	displace: Number,
})

const feeSettings = ref()

const displaceIdx = computed(() => {
	return popupStore.len - popupStore.popups.send?.order
})

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

	emit("onClose")
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

	if (selectedSendType.value === selectedReceiverType.value) {
		if (activeToken.value?.hasPrivateTransfers && selectedReceiverType.value === "public") {
			selectedReceiverType.value = "private"
		}

		if (!activeToken.value?.hasPublicTransfers && selectedReceiverType.value === "private") {
			selectedReceiverType.value = "public"
		}
	}
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
		emit("onClose")
	} catch (err) {
		const idx = appStore.awaitingTransactions.findIndex(
			(t) => t.destination === searchTerm.value && t.contract === activeToken.value.contract,
		)
		if (idx !== -1) appStore.awaitingTransactions.splice(idx, 1)

		openToast({ label: "Simulation failed, transaction not sent", icon: "warning", color: "red" }, TOAST_DURATION.LONG)
		console.error("[SendPopup] executeTransfer failed:", err)
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

		if (!amountTerm.value || !isValidAddress.value || !transferType.value || !feeSettings.value || !activeToken.value) {
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

watch(
	() => props.show,
	async () => {
		if (props.show) {
			tokens.value = await tokenService.getTokens(appStore.profile.id, appStore.network.chainId)
			tokenBalances.value = await tokenBalanceService.getTokenBalances(undefined, appStore.account.address)

			initSendType()
			initReceiverType()

			contacts.value = await contactService.getContacts()

			if (route.params.id) {
				cacheStore.activeTokenIdx = route.params.id
			}

			if (!cacheStore.activeTokenIdx && tokens.value.length) {
				cacheStore.activeTokenIdx = tokens.value[0].id
			}

			if (cacheStore.preselectedContactToSend) {
				handleSelectContact(cacheStore.preselectedContactToSend)
			}

			if (!tokens.value.length) {
				awaitingNewToken.value = true
			}

			document.addEventListener("keydown", onKeydown)
		} else {
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
		}
	},
)

const onKeydown = (e) => {
	if (e.key === "Enter") {
		if (showSuggestions.value) {
			handleSelectContact(filteredContacts.value[0])
			document.activeElement?.blur()
		}
	}
}
</script>

<template>
	<Popup :show @onClose="emit('onClose')" :displaceIdx="popupStore.popups.send?.order">
		<PopupCard large :displaceIdx>
			<Flex wide direction="column" justify="between" :class="$style.wrapper">
				<Flex align="center" direction="column" gap="16" :class="$style.top">
					<Flex align="center" gap="6">
						<Flex align="center" justify="center" :class="$style.send_icon">
							<Icon name="arrow-top-right-circle" size="16" color="primary" />

							<Icon
								name="globe"
								size="12"
								:color="getChainColor(appStore.network?.chainId)"
								:class="$style.warning_icon"
							/>
						</Flex>
						<Text size="16" weight="600" color="primary" style="transform: translate3d(0, 0, 0, 0)">
							Send
						</Text>

						<Text size="16" weight="600" color="tertiary">
							in {{ getChainName(appStore.network.chainId) }}
						</Text>
					</Flex>

					<Flex wide direction="column" gap="16">
						<Flex direction="column" gap="8">
							<SelectTokenCard :token="activeToken" />

							<SendTypesCard
								v-if="!isBlockedTransfer"
								v-model:sendType="selectedSendType"
								v-model:receiverType="selectedReceiverType"
								:token="activeToken"
							/>

							<AmountCard
								v-model="amountTerm"
								:selectedSendType
								:token="activeToken"
								:tokenBalanceByType
							/>
						</Flex>

						<Input
							v-model="searchTerm"
							@focus="isSearchInputFocused = true"
							@blur="handleSearchBlur()"
							:label="`${capitalize(selectedReceiverType)} destination`"
							placeholder="Enter name or address"
							data-testid="send-destination-input"
							wide
							:style="{ position: 'relative' }"
						>
							<template #right>
								<Flex v-if="selectedContact" align="center" gap="6" :class="$style.input_right">
									<Icon name="vault" size="12" color="blue" />
									<Text size="13" weight="600" color="primary" noWrap>
										{{ selectedContact?.name }}
									</Text>
								</Flex>
								<Flex v-else-if="!isSearchInputFocused && !isValidAddress && searchTerm.length > 0" align="center" gap="6" :class="$style.input_right">
									<Icon name="warning" size="12" color="red" />
									<Text size="12" weight="600" color="primary"> Invalid address </Text>
								</Flex>
								<Flex v-else-if="!isSearchInputFocused && isValidAddress" align="center" :class="$style.input_right">
									<Icon name="check-circle" size="14" color="green" />
								</Flex>
							</template>
							
							<template #bottom>
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
							</template>
						</Input>

						<FeeSettingsCard
							:profile="appStore.profile"
							:network="appStore.network"
							:account="appStore.account"
							:feeEstimate="feeEstimate"
							:isEstimating="isEstimating"
							v-model="feeSettings"
						/>
					</Flex>
				</Flex>

				<Flex direction="column" gap="12" :class="$style.bottom">
					<Button
						@click="handleSend"
						wide
						type="primary"
						size="medium"
						rightIcon="arrow-right-circle"
						data-testid="send-button"
						:disabled="!isAllowedToSend || isSending"
					>
						Send
					</Button>
				</Flex>
			</Flex>
		</PopupCard>
	</Popup>
</template>

<style module>
.wrapper {
	flex: 1;
}

.top {
	padding: 0 20px;
}

.selector {
	border-radius: 10px;
	background: var(--gray-10);

	padding: 2px;
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

	border-radius: 10px;
	box-shadow: inset 0 0 0 1px var(--border), 0 1px 3px var(--shadow-5);
	background: var(--card-bg);

	max-height: 150px;

	overflow-y: auto;

	.contact {
		cursor: pointer;

		padding: 8px 12px;
		transition: all 0.2s var(--bezier);

		&:hover {
			background: var(--gray-3);
		}

		&:active {
			background: var(--gray-5);
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
	padding: 20px;
}

.send_icon {
	position: relative;
}

.warning_icon {
	position: absolute;
	top: -6px;
	right: -6px;

	border-radius: 4px;
	background: var(--card-bg);
}
</style>
