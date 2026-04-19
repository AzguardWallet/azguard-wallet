<script setup>
/** Vendor */
import BN from "bignumber.js"

/** Utils */
import { purgeNumber, normalizeAmount, comma } from "@/utils/amount.js"

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
	if (props.tokenBalanceByType) inputEl.value.focus()
})

const handleAmountInput = (e) => {
	const purgedAmount = purgeNumber(model.value)

	model.value = purgedAmount

	if (["0", ","].includes(e.data) && model.value.length === 1) model.value = "0."

	const normalizedAmount = normalizeAmount(purgedAmount)
	if (typeof normalizedAmount === "string") {
		model.value = normalizedAmount
		return
	}
}

const isFocused = ref(false)
const handleAmountFocus = () => {
	if (props.tokenBalanceByType) isFocused.value = true
}
const handleAmountBlur = () => {
	isFocused.value = false

	if (!model.value) return
	if (model.value.toString().includes(",")) return model.value

	model.value = comma(model.value, ",", 8)
}

const amountInUSD = computed(() => Number.parseFloat(purgeNumber(model.value || 0)) * 3.4)

const handleFocus = () => {
	if (props.tokenBalanceByType) inputEl.value.focus()
}

const handleMax = () => {
	if (!props.tokenBalanceByType) return
	model.value = props.tokenBalanceByType
}

const handleHalf = () => {
	if (!model.value) {
		if (!props.tokenBalanceByType) return
		model.value = new BN(props.tokenBalanceByType) / 2
	} else {
		model.value = Number.parseFloat(purgeNumber(model.value)) / 2
	}
}
</script>

<template>
	<Flex @click="handleFocus" gap="8" direction="column" :class="$style.wrapper">
		<Flex direction="column" gap="4">
			<Flex align="baseline" gap="4">
				<input
					ref="inputEl"
					v-model="model"
					@input="handleAmountInput"
					@focus="handleAmountFocus"
					@blur="handleAmountBlur"
					:disabled="!tokenBalanceByType"
					placeholder="0.00"
					data-testid="send-amount-input"
					:class="$style.input_field"
				/>
			</Flex>

			<Flex align="center" justify="between">
				<Tooltip position="start">
					<Flex align="center" gap="4" style="opacity: 0.5">
						<span :class="$style.conversion">~ $0.00</span>
						<Icon name="warning" size="10" color="tertiary" />
					</Flex>

					<template #content> No quotes available at the moment</template>
				</Tooltip>

				<Flex align="center" gap="8">
					<span @click="handleHalf" data-testid="send-amount-half" :class="$style.action_link">Half</span>
					<span @click="handleMax" data-testid="send-amount-max" :class="$style.action_link">Use Maximum</span>
				</Flex>
			</Flex>
		</Flex>

		<Flex v-if="token && tokenBalanceByType" align="center" gap="4" :class="$style.balance_row">
			<span :class="$style.balance_text">{{ comma(tokenBalanceByType, ",", 8) }} {{ token.symbol }} · {{ selectedSendType }}</span>
		</Flex>
	</Flex>
</template>

<style module>
.wrapper {
	width: 100%;

	cursor: text;
	padding: 8px 0;
}

.input_field {
	width: 100%;

	font-family: var(--font-headline);
	font-size: 40px;
	font-weight: 700;
	letter-spacing: -0.04em;
	color: var(--txt-primary);

	&::placeholder {
		color: var(--txt-tertiary);
	}
}

.conversion {
	font-family: var(--font-mono);
	font-size: 10px;
	color: var(--nulo-secondary);
}

.action_link {
	font-family: var(--font-headline);
	font-size: 10px;
	font-weight: 700;
	text-transform: uppercase;
	letter-spacing: 0.1em;
	color: var(--nulo-accent);
	cursor: pointer;

	transition: opacity 0.2s var(--bezier);

	&:hover {
		text-decoration: underline;
	}
}

.balance_row {
	padding: 4px 0;
}

.balance_text {
	font-family: var(--font-mono);
	font-size: 11px;
	color: var(--nulo-secondary);
}
</style>
