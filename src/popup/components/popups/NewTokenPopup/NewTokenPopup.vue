<script setup>
/** Components */
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"
import CandidatesForm from "./CandidatesForm.vue"

/** Utils */
import { managers } from "@/utils/core"

/** Composables */
import { useToast } from "@/composables/toast"
const { openToast } = useToast()

/** Store */
import { useAppStore } from "@/stores/app.store"
import { usePopupStore } from "@/stores/popup.store"
const appStore = useAppStore()
const popupStore = usePopupStore()

const displaceIdx = computed(() => {
	return popupStore.len - popupStore.popups.new_token
})

const props = defineProps({
	show: Boolean,
})

const emit = defineEmits(["onClose"])

const contractAddressTerm = ref("")

const isLoadingParseResult = ref(false)
const isAlreadyExist = computed(() => appStore.tokens.findLast(t => t.contract === contractAddressTerm.value))
const isAvailableToCreateToken = computed(() => {
	if (!contractAddressTerm.value.length || contractAddressTerm.value.length !== 66) return
	if (!contractAddressTerm.value.startsWith("0x")) return
	if (isLoadingParseResult.value) return
	if (isAlreadyExist.value) return

	return true
})

const isCompleted = ref(true)
const rawToken = ref()

const handleSelectCandidate = (target, candidate) => {
	rawToken.value[target] = candidate
}

const handleCreateToken = async () => {
	if (!isAvailableToCreateToken.value) return

	isLoadingParseResult.value = true
	appStore.isLoading = true

	const parsingResult = await managers.token.parseInterface(contractAddressTerm.value)

	if (!parsingResult.isComplete) {
		isLoadingParseResult.value = false
		appStore.isLoading = false

		isCompleted.value = false
		rawToken.value = parsingResult

		return
	}

	isLoadingParseResult.value = false
	appStore.isLoading = false

	if (!parsingResult.isComplete) {
		openToast({ label: "Something went wrong", icon: "close-circle" })
		return
	}

	const newToken = await managers.token.addToken(parsingResult)
	appStore.tokens.push(newToken)

	await appStore.syncBalances()
	// appStore.tokenAwaitingBalanceIdx = newToken.id

	openToast({ label: `${parsingResult.symbol} is added to tokens` })

	emit("onClose")
}
const handleSaveToken = async () => {
	const newToken = await managers.token.addToken(rawToken.value)
	appStore.tokens.push(newToken)

	await appStore.syncBalances()
	// appStore.tokenAwaitingBalanceIdx = newToken.id

	openToast({ label: `${rawToken.value.symbol} is added to tokens` })

	emit("onClose")
}

watch(
	() => props.show,
	() => {
		if (!props.show) {
			contractAddressTerm.value = ""
		}
	},
)
</script>

<template>
	<Popup :show="show" @onClose="emit('onClose')" :displaceIdx="popupStore.popups.new_token">
		<PopupCard :displaceIdx>
			<Flex wide direction="column" gap="20" :class="$style.wrapper">
				<Text size="14" weight="600" color="primary"> New token </Text>

				<Input
					v-model="contractAddressTerm"
					label="Contract address"
					placeholder="0x"
					:disabled="isLoadingParseResult"
				>
					<template #suffix>
						<Icon v-if="isAvailableToCreateToken" name="check-circle" size="14" color="green" />
					</template>
					<template #right>
						<Transition name="fade">
							<Flex v-if="isAlreadyExist" align="center" gap="4">
								<Icon name="warning" size="12" color="orange" />
								<Text size="12" weight="600" color="primary"> Already imported </Text>
							</Flex>
						</Transition>
					</template>
				</Input>

				<CandidatesForm v-if="!isCompleted" :token="rawToken" @onSelect="handleSelectCandidate" />

				<Button
					v-if="isCompleted"
					@click="handleCreateToken"
					wide
					type="primary"
					size="medium"
					:loading="isLoadingParseResult"
					:disabled="!isAvailableToCreateToken"
				>
					<Text color="inverse">Import new token</Text>
				</Button>
				<Button
					v-else
					@click="handleSaveToken"
					wide
					type="primary"
					size="medium"
					:disabled="!isAvailableToCreateToken"
				>
					<Text color="inverse">Save new token</Text>
				</Button>

				<Text size="12" weight="500" color="tertiary" height="140" align="center">
					Importing the token may take time and additional configuration may be required
				</Text>
			</Flex>
		</PopupCard>
	</Popup>
</template>

<style module>
.wrapper {
	padding: 0 20px 24px 20px;
}

.network {
	border-radius: 12px;
	cursor: pointer;
	box-shadow: inset 0 0 0 1px var(--gray-10), 0 1px 2px var(--gray-5);

	padding: 12px;

	transition: all 0.2s var(--bezier);

	&:hover {
		background: var(--gray-3);

		& .icons {
			opacity: 1;
		}
	}

	&:active {
		background: var(--gray-5);
	}
}

.icons {
	opacity: 0;

	transition: all 0.2s var(--bezier);
}

.item {
	height: 30px;

	border-radius: 8px;
	box-shadow: inset 0 0 0 2px var(--gray-5);
	cursor: pointer;

	padding: 0 16px;

	transition: all 0.2s var(--bezier);

	&:hover {
		box-shadow: inset 0 0 0 2px var(--gray-10);
	}

	&:active {
		background: var(--gray-5);
	}

	&.selected {
		background: var(--green);
	}

	&.disabled {
		opacity: 0.5;
		pointer-events: none;
	}
}
</style>
