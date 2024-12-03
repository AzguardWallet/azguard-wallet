<script setup>
/** Vendor */
import BN from "bignumber.js"

/** Components */
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"

/** Utils */
import { managers } from "@/utils/core"

/** Composables */
import { useToast } from "@/composables/toast"
const { openToast } = useToast()

/** Store */
import { useAppStore } from "@/stores/app.store"
import { usePopupStore } from "@/stores/popup.store"
import { useCacheStore } from "@/stores/cache.store"
const appStore = useAppStore()
const popupStore = usePopupStore()
const cacheStore = useCacheStore()

const displaceIdx = computed(() => {
	return popupStore.len - popupStore.popups.faucet
})

const emit = defineEmits(["onClose"])
const props = defineProps({
	show: Boolean,
})

const tokenNameTerm = ref("")
const tokenSymbolTerm = ref("")
const amountTerm = ref("")

const isAvailableToMint = computed(() => {
	if (!tokenNameTerm.value.length) return
	if (!tokenSymbolTerm.value.length) return
	if (!amountTerm.value.length) return

	return true
})

const isMinting = ref(false)
const handleMint = async () => {
	if (!isAvailableToMint.value) return

	isMinting.value = true
	await managers.faucet.mint(
		appStore.network.id,
		appStore.account.address,
		tokenNameTerm.value,
		tokenSymbolTerm.value,
		8,
		new BN(amountTerm.value).times(10 ** 8)
	)
	isMinting.value = false

	appStore.syncLocalTokens()

	emit("onClose")

	openToast({ label: "Succesfully minted" })
}

watch(
	() => props.show,
	() => {
		if (!props.show) {
			document.removeEventListener("keydown", onKeydown)

			// handleFillFieldsWithDefaultValues()
		} else {
			document.addEventListener("keydown", onKeydown)

			// handleFillFieldsWithDefaultValues()
		}
	}
)

const onKeydown = (e) => {
	if (e.code === "Enter") handleMint()
}
</script>

<template>
	<Popup
		:show
		@onClose="emit('onClose')"
		:displaceIdx="popupStore.popups.faucet"
	>
		<PopupCard :displaceIdx>
			<Flex wide direction="column" gap="20" :class="$style.wrapper">
				<Flex direction="column" gap="12">
					<Text size="14" weight="600" color="primary"> Faucet </Text>

					<Banner>
						The Faucet functionality is here temporarily<Text
							color="tertiary"
							>, it will be moved elsewhere in the next updates.
						</Text>
					</Banner>
				</Flex>

				<Input
					label="Token Name"
					placeholder="Name"
					v-model="tokenNameTerm"
					autofocus
				/>
				<Input
					label="Token Symbol"
					placeholder="Symbol"
					v-model="tokenSymbolTerm"
				/>
				<Input label="Amount" placeholder="0.00" v-model="amountTerm" />

				<Button
					@click="handleMint"
					wide
					type="primary"
					size="medium"
					:disabled="!isAvailableToMint"
					:loading="isMinting"
				>
					<Text color="inverse">Mint</Text>
				</Button>
			</Flex>
		</PopupCard>
	</Popup>
</template>

<style module>
.wrapper {
	padding: 0 20px 24px 20px;
}
</style>
