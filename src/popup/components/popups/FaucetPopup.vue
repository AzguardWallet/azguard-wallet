<script setup>
/** Vendor */
import BN from "bignumber.js"

/** Components */
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"

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

const isAllowedToMint = computed(() => {
	if (!tokenNameTerm.value.length) return
	if (!tokenSymbolTerm.value.length) return
	if (!amountTerm.value || new BN(amountTerm.value) <= 0) return
	if (new BN(amountTerm.value) > 100_000) return

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
			new BN(amountTerm.value).times(10 ** 8),
		)
		isMinting.value = false

		await appStore.syncLocalTokens()

		const tokenAwaitingBalanceIdx = appStore.tokens.findLast(t => t.symbol === tokenSymbolTerm.value)?.id
		if (tokenAwaitingBalanceIdx) {
			appStore.tokenAwaitingBalanceIdx = tokenAwaitingBalanceIdx
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
			<Flex wide direction="column" gap="20" :class="$style.wrapper">
				<Flex direction="column" gap="12">
					<Text size="14" weight="600" color="primary"> Faucet </Text>

					<Banner>
						The Faucet functionality is here temporarily<Text color="tertiary"
							>, it will be moved elsewhere in the next updates.
						</Text>
					</Banner>
				</Flex>

				<Input
					label="Token Name"
					placeholder="Name"
					v-model="tokenNameTerm"
					:disabled="isPreselected"
					@focus="error = null"
					:autofocus="!token"
				/>
				<Input
					label="Token Symbol"
					placeholder="Symbol"
					v-model="tokenSymbolTerm"
					:disabled="isPreselected"
					@focus="error = null"
				/>
				<Input
					label="Amount"
					placeholder="0.00"
					v-model="amountTerm"
					@focus="error = null"
					@input="handleAmountInput"
					:autofocus="!!token"
				>
				</Input>

				<Flex align="center" direction="column" gap="12">
					<Button
						@click="handleMint"
						wide
						type="primary"
						size="medium"
						:disabled="!isAllowedToMint"
						:loading="isMinting"
					>
						<Text color="inverse">{{ isMinting ? "Minting in progress" : "Mint" }}</Text>
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
