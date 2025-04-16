<script setup>
/** Vendor */
import BN from "@/utils/bn.js"

/** Components */
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"
import PopupHeader from "@/components/ui/Popup/PopupHeader.vue"
import FeeSettingsCard from "@/popup/components/modules/send/FeeSettingsCard.vue"

/** Utils */
import { purgeNumber, normalizeAmount } from "@/utils/amount.js"
import { managers } from "@/utils/core"

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

const feeSettings = ref()

const tokens = computed(() => appStore.tokens)
const token = computed(() =>
	tokens.value.find(t => t.id == route.params.id || (t.symbol === tokenSymbolTerm.value && t.name === tokenNameTerm.value)),
)
const mintingTokenId = ref()

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
	if (tokenNameTerm.value.length > 32) return
	if (!tokenSymbolTerm.value.length) return
	if (tokenSymbolTerm.value.length > 32) return
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
	try {
		const symbol = tokenSymbolTerm.value.trim()
		if (!token.value) {
			appStore.dummyTokens.push({
				id: -1,
				symbol,
				name: "Minting in progress...",
			})
		} else {
			mintingTokenId.value = token.value.id
			appStore.mintingTokens.push(mintingTokenId.value)
		}

		emit("onClose")

		await managers.faucet.mint(
			appStore.network.id,
			appStore.account.address,
			tokenNameTerm.value.trim(),
			symbol,
			8,
			new BN(amountTerm.value).times(10 ** 8).dividedBy(2),
			feeSettings.value,
		)

		if (mintingTokenId.value) {
			appStore.mintingTokens.pop()
			appStore.tokensAwaitingBalanceRefresh.push(mintingTokenId.value)
		}
	} catch (err) {
		error.value = err

		openToast({ label: "Failed to mint", icon: "warning" })

		if (!mintingTokenId.value) {
			appStore.dummyTokens.pop()
		} else {
			appStore.mintingTokens.pop()
		}
	} finally {
		isLoading.value = false
	}
}

watch(
	() => props.show,
	() => {
		if (!props.show) {
			document.removeEventListener("keydown", onKeydown)

			tokenNameTerm.value = ""
			tokenSymbolTerm.value = ""
			amountTerm.value = ""
			isPreselected.value = false
		} else {
			document.addEventListener("keydown", onKeydown)

			mintingTokenId.value = null
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
					:disabled="isPreselected"
					@focus="error = null"
					@input="handleNameInput"
					:autofocus="!token"
				/>
				<Input
					label="Token Symbol"
					placeholder="Symbol"
					v-model="tokenSymbolTerm"
					:disabled="isPreselected"
					@focus="error = null"
					@input="handleSymbolInput"
				/>
				<Input
					label="Total Amount"
					placeholder="0.00"
					v-model="amountTerm"
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
						Mint
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
