<script setup>
/** Services */
import { FaucetServiceClient } from "@/wallet/services/faucet/client"
import { TokenServiceClient } from "@/wallet/services/token/client"
import { TokenBalanceServiceClient } from "@/wallet/services/token-balance/client"

/** Vendor */
import BN from "bignumber.js"

/** Components */
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"
import PopupHeader from "@/components/ui/Popup/PopupHeader.vue"
import FeeSettingsCard from "@/popup/components/modules/send/FeeSettingsCard.vue"

/** Utils */
import { purgeNumber, normalizeAmount } from "@/utils/amount.js"

/** Composables */
import { useToast } from "@/composables/toast"
const { openToast } = useToast()

/** Store */
import { useAppStore } from "@/stores/app.store"
import { usePopupStore } from "@/stores/popup.store"
const appStore = useAppStore()
const popupStore = usePopupStore()

const route = useRoute()

const displaceIdx = computed(() => {
	return popupStore.len - popupStore.popups.faucet?.order
})

const emit = defineEmits(["onClose"])
const props = defineProps({
	show: Boolean,
})

const faucetService = new FaucetServiceClient()

const feeSettings = ref()

const tokenService = new TokenServiceClient()
tokenService.onTokenAdded.add(onTokenAdded)
tokenService.onTokenDeleted.add(onTokenDeleted)
function onTokenAdded(token) {
	tokens.value.push(token)
}
function onTokenDeleted(token) {
	const idx = tokens.value.findIndex(t => t.id === token.id)
	if (idx === -1) return

	tokens.value.splice(idx, 1)
}

const tokenBalanceService = new TokenBalanceServiceClient()

const tokens = ref([])
const token = computed(() =>
	tokens.value.find(t => t.id == route.params.id || (t.symbol === tokenSymbolTerm.value && t.name === tokenNameTerm.value)),
)

const isPreselected = ref(false)
const tokenNameTerm = ref("")
const tokenSymbolTerm = ref("")
const amountTerm = ref("")

const isLoading = ref(false)

const handleAmountInput = e => {
	if (amountTerm.value.length >= 32) {
		amountTerm.value = amountTerm.value.slice(0, 32)
		return
	}

	if (new BN(amountTerm.value) > 100_000) {
		amountTerm.value = 100_000
		return
	}

	if (["0", ","].includes(e.data) && amountTerm.value.length === 1) {
		amountTerm.value = "0."
		return
	}

	amountTerm.value = purgeNumber(amountTerm.value)

	const normalizedAmount = normalizeAmount(amountTerm.value)
	if (typeof normalizedAmount === "string") {
		amountTerm.value = normalizedAmount
	}
}

const handleNameInput = () => {
	if (tokenNameTerm.value.length >= 32) {
		tokenNameTerm.value = tokenNameTerm.value.slice(0, 32)
	}
}
const handleSymbolInput = () => {
	if (tokenSymbolTerm.value.length >= 32) {
		tokenSymbolTerm.value = tokenSymbolTerm.value.slice(0, 32)
	}
}

const isAllowedToMint = computed(() => {
	if (!tokenNameTerm.value.length) return
	if (!tokenSymbolTerm.value.length) return
	if (!feeSettings.value) return

	const bnAmount = new BN(amountTerm.value)
	if (!amountTerm.value || bnAmount <= 0) return
	if (bnAmount > 100_000) return
	if (bnAmount < 0.0000001) return

	return true
})

const error = ref()
const isErrorOccurred = computed(() => !!error.value)
const handleMint = async () => {
	if (!isAllowedToMint.value) return

	isLoading.value = true
	error.value = null
	const mintingAddress = appStore.account.address

	try {
		const name = tokenNameTerm.value.trim()
		const symbol = tokenSymbolTerm.value.trim()

		const balance = (
			await tokenBalanceService.getTokenBalances(undefined, mintingAddress)
		).find(tb => tb.token.name === name && tb.token.symbol === symbol)

		emit("onClose")

		await faucetService.mint(
			appStore.network.id,
			mintingAddress,
			name,
			symbol,
			8,
			new BN(amountTerm.value).times(10 ** 8),
			feeSettings.value,
		)

		if (balance) {
			tokenBalanceService.refreshTokenBalance(balance.id)
		}
	} catch (err) {
		error.value = err

		openToast({ label: "Failed to mint", icon: "warning" })
	} finally {
		isLoading.value = false
		tokenNameTerm.value = ""
		tokenSymbolTerm.value = ""
		amountTerm.value = ""
		tokens.value = []
		tokenService.disconnect()
		tokenBalanceService.disconnect()
	}
}

watch(
	() => props.show,
	async () => {
		if (!props.show) {
			document.removeEventListener("keydown", onKeydown)

			if (!isLoading.value) {
				tokenNameTerm.value = ""
				tokenSymbolTerm.value = ""
				amountTerm.value = ""
				tokens.value = []
				tokenService.disconnect()
			}

			isPreselected.value = false
		} else {
			document.addEventListener("keydown", onKeydown)

			tokens.value = await tokenService.getTokens(appStore.profile.id, appStore.network.chainId)

			if (token.value) {
				isPreselected.value = true
				tokenNameTerm.value = token.value.name
				tokenSymbolTerm.value = token.value.symbol
			}
		}
	},
)

const onKeydown = e => {
	if (e.key === "Enter") handleMint()
}
</script>

<template>
	<Popup :show @onClose="emit('onClose')" :displaceIdx="popupStore.popups.faucet?.order">
		<PopupCard :displaceIdx>
			<PopupHeader @onClose="emit('onClose')" closable>
				<template #title>
					<Text size="14" weight="600" color="primary">Faucet</Text>
				</template>
			</PopupHeader>

			<Flex wide direction="column" gap="20" :class="$style.wrapper">
				<Banner direction="vertical">
					<template #title> The Faucet functionality is here temporarily </template>
					<template #description> It will be moved elsewhere in the future </template>
				</Banner>

				<Input
					label="Token Name"
					placeholder="Name"
					v-model="tokenNameTerm"
					sanitize
					:maxLength="32"
					:disabled="isPreselected || isLoading"
					@focus="error = null"
					@input="handleNameInput"
					:autofocus="!token"
				/>
				<Input
					label="Token Symbol"
					placeholder="Symbol"
					v-model="tokenSymbolTerm"
					sanitize
					:maxLength="32"
					:disabled="isPreselected || isLoading"
					@focus="error = null"
					@input="handleSymbolInput"
				/>
				<Input
					label="Total Amount"
					placeholder="0.00"
					v-model="amountTerm"
					:disabled="isLoading"
					@focus="error = null"
					@input="handleAmountInput"
					:autofocus="!!token"
				>
					<template #suffix>
						<Text size="13" weight="600" color="tertiary">{{ tokenSymbolTerm }}</Text>
					</template>

					<template v-if="amountTerm" #right>
						<Tooltip position="end" side="top">
							<Icon name="info" size="12" color="tertiary" hoverColor="primary" />

							<template #content>
								<Flex direction="column" gap="16">
									<Flex direction="column" gap="8">
										<Flex align="center" justify="between">
											<Text color="secondary">Min:</Text>
											<Text color="primary">0.0000001</Text>
										</Flex>
										<Flex align="center" justify="between">
											<Text color="secondary">Max:</Text>
											<Text color="primary">100,000</Text>
										</Flex>
									</Flex>

									<Flex direction="column" gap="8">
										<Flex align="center" justify="between">
											<Text color="secondary">Private balance:</Text>
											<Text color="primary">
												&nbsp;{{ new BN(amountTerm).dividedBy(2).toFormat() }}
											</Text>
										</Flex>

										<Flex align="center" justify="between">
											<Text color="secondary">Public balance:</Text>
											<Text color="primary">
												&nbsp;{{ new BN(amountTerm).dividedBy(2).toFormat() }}
											</Text>
										</Flex>

										<Flex align="center" justify="between">
											<Text color="secondary">Total amount:</Text>
											<Text color="primary"> &nbsp;{{ new BN(amountTerm).toFormat() }} </Text>
										</Flex>
									</Flex>
								</Flex>
							</template>
						</Tooltip>
					</template>
				</Input>

				<FeeSettingsCard
					:profile="appStore.profile"
					:network="appStore.network"
					:account="appStore.account"
					v-model="feeSettings"
				/>

				<Flex align="center" direction="column" gap="12">
					<Button
						@click="handleMint"
						type="primary"
						size="medium"
						wide
						:loading="isLoading"
						:disabled="!isAllowedToMint"
					>
						{{ isLoading ? 'Minting' : 'Mint' }}
					</Button>

					<Tooltip v-if="isErrorOccurred" side="top">
						<Flex align="center" gap="6">
							<Icon name="info" size="12" color="red" />
							<Text size="12" weight="500" color="secondary">
								There was an error in the minting process
							</Text>
						</Flex>

						<template #content> {{ error }} </template>
					</Tooltip>
				</Flex>
			</Flex>
		</PopupCard>
	</Popup>
</template>

<style module>
.wrapper {
	padding: 0 20px 24px 20px;
}
</style>
