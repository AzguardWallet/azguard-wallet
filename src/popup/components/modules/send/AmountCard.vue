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

const warning = ref("")

const decimals = computed(() => props.token?.decimals ?? 8)

const handleAmountInput = e => {
	const purgedAmount = purgeNumber(model.value)

	model.value = purgedAmount

	if (["0", ","].includes(e.data) && model.value.length === 1) model.value = "0."

	const normalizedAmount = normalizeAmount(purgedAmount)
	if (typeof normalizedAmount === "string") {
		model.value = normalizedAmount
		return
	}
}

const parseAmountBN = () => {
	const raw = model.value
	if (!raw) return null

	const normalized = purgeNumber(raw)
	if (!normalized || normalized === '.') return null

	try {
		return new BN(normalized)
	} catch {
		return null
	}
}

const formatAmount = (bn) => {
	const formatted = bn
		.decimalPlaces(decimals.value, BN.ROUND_HALF_UP)
		.toFormat(decimals.value)
		.replace(/\.?0+$/, '')

	return formatted.replace(
		new RegExp(`\\${getDecimalSeparator()}0+$`),
		''
	).replace(
		new RegExp(`\\${getDecimalSeparator()}$`),
		''
	)
}

const isFocused = ref(false)
const handleAmountFocus = () => {
	if (props.tokenBalanceByType) isFocused.value = true
}

const amountInUSD = computed(() => {
	const bn = parseAmountBN()
	if (!bn) return 0

	return bn.times(3.4).toNumber()
})

const handleFocus = () => {
	if (props.tokenBalanceByType) inputEl.value.focus()
}

const normalizeToTokenStep = (bn, decimals) => {
	const step = new BN(1).div(new BN(10).pow(decimals))

	return bn
		.div(step)
		.integerValue(BN.ROUND_CEIL)
		.times(step)
}

const handleAmountBlur = () => {
	isFocused.value = false
	warning.value = ""

	const bn = parseAmountBN()
	if (!bn) return

	const normalized = normalizeToTokenStep(bn, decimals.value)

	if (!bn.eq(normalized)) {
		warning.value = `Amount adjusted to token precision (${decimals.value} decimals).`
	}

	model.value = formatAmount(normalized)
}

const handleMax = () => {
	if (!props.tokenBalanceByType) return

	model.value = formatAmount(
		new BN(props.tokenBalanceByType)
	)
}

const handleHalf = () => {
	if (!props.tokenBalanceByType) return

	const base = parseAmountBN() ?? new BN(props.tokenBalanceByType)

	model.value = formatAmount(
		base.div(2)
	)
}

onMounted(() => {
	if (props.tokenBalanceByType) inputEl.value.focus()
})
</script>

<template>
	<Flex @click="handleFocus" gap="16" direction="column" :class="[$style.wrapper, isFocused && $style.focused]">
		<Flex direction="column" gap="8" style="position: relative;">
			<input
				ref="inputEl"
				v-model="model"
				@input="handleAmountInput"
				@focus="handleAmountFocus"
				@blur="handleAmountBlur"
				:disabled="!tokenBalanceByType"
				placeholder="0.00"
				:class="$style.input_field"
			/>

			<Tooltip v-if="warning" position="end" side="top" :class="$style.warning">
				<Icon name="warning" size="12" color="yellow" />

				<template #content>
					<Text size="12" color="secondary">
						{{ warning }}
					</Text>
				</template>
			</Tooltip>
			

			<Tooltip position="start">
				<Flex align="center" gap="4" style="opacity: 0.5">
					<Text size="14" weight="500" color="tertiary"> $0.00 </Text>
					<Icon name="warning" size="12" color="tertiary" />
				</Flex>

				<template #content> No quotes available at the moment</template>
			</Tooltip>
		</Flex>

		<Flex justify="between">
			<Flex align="center" gap="6">
				<Button @click="handleHalf" type="secondary" size="mini" round> Half </Button>
				<Button @click="model = null" type="secondary" size="mini" round> Clear </Button>
			</Flex>

			<Button
				v-if="token"
				@click="handleMax"
				type="secondary"
				size="mini"
				round
				:disabled="!tokenBalanceByType"
				:class="$style.test"
			>
				<Icon
					:name="selectedSendType === 'private' ? 'key-square' : 'face'"
					size="16"
					:color="selectedSendType === 'private' ? 'green' : 'orange'"
				/>
				<Text :class="$style.testtest">
					{{ comma(tokenBalanceByType, ",", 8) }}
				</Text>
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

.warning {
	position: absolute;
	top: 0;
	right: 0;

	cursor: help;
}

.test {
	max-width: 180px;
}

.testtest {
	text-overflow: ellipsis;
	overflow: hidden;
}
</style>
