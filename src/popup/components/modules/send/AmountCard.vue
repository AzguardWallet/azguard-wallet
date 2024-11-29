<script setup>
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

const handleFromInput = () => {
	const normalizedAmount = normalizeAmount(model.value)
	if (typeof normalizedAmount === "string") {
		model.value = normalizedAmount
		return
	}

	model.value = comma(purgeNumber(model.value), ",", 4)
}

const amountInUSD = computed(
	() => Number.parseFloat(purgeNumber(model.value || 0)) * 3.4
)

const handleMax = () => {
	if (!props.tokenBalanceByType) return
	model.value = comma(props.tokenBalanceByType)
}

const handleHalf = () => {
	model.value = comma(Number.parseFloat(purgeNumber(model.value)) / 2)
}
</script>

<template>
	<Flex gap="16" direction="column" :class="$style.wrapper">
		<Flex direction="column" gap="8">
			<input
				ref="inputEl"
				v-model="model"
				@input="handleFromInput"
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
				<Button @click="model = 0" type="secondary" size="mini" round>
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

	background: var(--card-bg);
	border-radius: 12px;
	box-shadow: inset 0 0 0 1px var(--gray-10), 0 1px 2px var(--shadow-5);

	padding: 16px;
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
