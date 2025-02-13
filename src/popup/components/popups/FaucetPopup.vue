<script setup>
/** Vendor */
import BN from "bignumber.js"

/** Components */
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"
import PopupHeader from "@/components/ui/Popup/PopupHeader.vue"

/** Utils */
import { comma, purgeNumber, normalizeAmount } from "@/utils/amount.js"
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
	return popupStore.len - popupStore.popups.faucet
})

const emit = defineEmits(["onClose"])
const props = defineProps({
	show: Boolean,
})

const token = computed(() =>
	// biome-ignore lint/suspicious/noDoubleEquals: <explanation>
	appStore.tokens.find(t => t.id == route.params.id),
)

const isPreselected = ref(false)
const tokenNameTerm = ref("")
const tokenSymbolTerm = ref("")
const amountTerm = ref("")

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
	if (!amountTerm.value || new BN(amountTerm.value) <= 0) return
	if (new BN(amountTerm.value) > 100_000) return
	if (new BN(amountTerm.value) < 0.0000001) return

	return true
})

const isMinting = ref(false)
const error = ref()
const isErrorOccurred = computed(() => !!error.value)
const handleMint = async () => {
	if (!isAllowedToMint.value) return

	try {
		isMinting.value = true

		await managers.faucet.mint(
			appStore.network.id,
			appStore.account.address,
			tokenNameTerm.value.trim(),
			tokenSymbolTerm.value.trim(),
			8,
			new BN(amountTerm.value).times(10 ** 8).dividedBy(2),
		)
		isMinting.value = false

		await appStore.syncLocalTokens()

		const tokenAwaitingBalanceIdx = appStore.tokens.findLast(t => t.symbol === tokenSymbolTerm.value)?.id
		if (tokenAwaitingBalanceIdx) {
			appStore.tokensAwaitingBalanceRefresh.push(tokenAwaitingBalanceIdx)
		}

		emit("onClose")

		openToast({ label: "Succesfully minted" })
	} catch (err) {
		error.value = err
		isMinting.value = false
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
	<Popup :show @onClose="emit('onClose')" :displaceIdx="popupStore.popups.faucet">
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
					:disabled="isPreselected || isMinting"
					@focus="error = null"
					@input="handleNameInput"
					:autofocus="!token"
				/>
				<Input
					label="Token Symbol"
					placeholder="Symbol"
					v-model="tokenSymbolTerm"
					:disabled="isPreselected || isMinting"
					@focus="error = null"
					@input="handleSymbolInput"
				/>
				<Input
					label="Total Amount"
					placeholder="0.00"
					v-model="amountTerm"
					:disabled="isMinting"
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

				<Flex align="center" direction="column" gap="12">
					<Button
						@click="handleMint"
						wide
						:type="isMinting ? 'secondary' : 'primary'"
						size="medium"
						:disabled="!isAllowedToMint"
						:loading="isMinting"
					>
						{{ isMinting ? "Minting" : "Mint" }}
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
