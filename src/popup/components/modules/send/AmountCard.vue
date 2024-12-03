<script setup>
/** Vendor */
import BN from "bignumber.js"

/** Utils */
import { purgeNumber, normalizeAmount, comma } from "@/utils/amount.js"

/** Store */
import { useAppStore } from "@/stores/app.store"
import { useCacheStore } from "@/stores/cache.store"
const appStore = useAppStore()
const cacheStore = useCacheStore()

const props = defineProps({
	selectedSendType: {
		type: String,
	},
	token: {
		type: Object,
		required: false,
	},
	tokenBalanceByType: Number,
})

const model = defineModel()

const inputEl = useTemplateRef("inputEl")

onMounted(() => {
	inputEl.value.focus()
})

const handleAmountInput = (e) => {
	const purgedAmount = purgeNumber(model.value)
	model.value = purgedAmount

	if (["0", ","].includes(e.data) && model.value.length === 1)
		model.value = "0."

	const normalizedAmount = normalizeAmount(purgedAmount)
	if (typeof normalizedAmount === "string") {
		model.value = normalizedAmount
		return
	}
}

const isFocused = ref(false)
const handleAmountFocus = () => {
	isFocused.value = true
}
const handleAmountBlur = () => {
	isFocused.value = false

	if (!model.value) return
	if (model.value.toString().includes(",")) return model.value

	model.value = comma(model.value, ",", 4)
}

const amountInUSD = computed(
	() => Number.parseFloat(purgeNumber(model.value || 0)) * 3.4
)

const handleMax = () => {
	if (!props.tokenBalanceByType) return
	model.value = props.tokenBalanceByType
}

const handleHalf = () => {
	if (!model.value) return
	model.value = Number.parseFloat(purgeNumber(model.value)) / 2
}
</script>

<template>
	<Flex
		@click="inputEl.focus()"
		gap="16"
		direction="column"
		:class="[$style.wrapper, isFocused && $style.focused]"
	>
		<Flex direction="column" gap="8">
			<input
				ref="inputEl"
				v-model="model"
				@input="handleAmountInput"
				@focus="handleAmountFocus"
				@blur="handleAmountBlur"
				placeholder="0.00"
				:class="$style.input_field"
			/>
			<Text size="14" weight="500" color="tertiary">
				${{ comma(amountInUSD) }}
			</Text>
		</Flex>

		<Flex justify="between">
			<Flex align="center" gap="6">
				<Button @click="handleHalf" type="secondary" size="mini" round>
					Half
				</Button>
				<Button
					@click="model = null"
					type="secondary"
					size="mini"
					round
				>
					Clear
				</Button>
			</Flex>

			<Button
				@click="handleMax"
				type="secondary"
				size="mini"
				round
				:disabled="!tokenBalanceByType"
			>
				<Icon
					:name="
						selectedSendType === 'private' ? 'key-square' : 'face'
					"
					size="16"
					:color="selectedSendType === 'private' ? 'green' : 'orange'"
				/>
				{{ comma(tokenBalanceByType) }}
				<Text color="tertiary">{{ token.symbol }}</Text>
			</Button>
		</Flex>
	</Flex>
</template>

<style module>
.wrapper {
	width: 100%;

	cursor: text;
	background: var(--card-bg);
	border-radius: 12px;
	box-shadow: inset 0 0 0 1px var(--gray-10), 0 1px 2px var(--shadow-5);

	padding: 16px;

	transition: all 0.2s var(--bezier);

	&.focused {
		box-shadow: inset 0 0 0 2px var(--blue);
	}
}

.input_field {
	width: 100%;

	font-size: 28px;
	font-weight: 600;
	color: var(--txt-primary);

	&::placeholder {
		color: var(--txt-tertiary);
	}
}
</style>
