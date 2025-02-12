<script setup>
/** Vendor */
import { DateTime } from "luxon"
import BN from "bignumber.js"

/** Utils */
import { comma } from "@/utils/amount.js"

const props = defineProps({
	tx: {
		type: Object,
	},
})

const call = computed(() => props.tx.calls[0])
const type = computed(() => {
	if (call.value.method.startsWith("transfer")) return "transfer"
	if (call.value.method.startsWith("mint_to_")) return "mint"
	return "tx"
})
const transfer = computed(() => (call.value?.transfers ? call.value.transfers[0] : null))
const transferAmount = computed(() => new BN((transfer.value?.amount ?? 0) / 10 ** 8).toFixed())
const mintAmount = computed(() => new BN((call.value.args[2] ?? 0) / 10 ** 8).toFixed() * 2) /** refactor */
const token = computed(() => transfer.value?.token)

const icon = computed(() => {
	if (type.value === "transfer") return "arrow-narrow-up-right"
	if (type.value === "mint") return "faucet"
	return "zap"
})

const title = computed(() => {
	if (type.value === "transfer") return "Transfer"
	if (type.value === "mint") return "Mint"
	return "Transaction"
})
</script>

<template>
	<Flex align="center" justify="between" :class="$style.wrapper">
		<Flex align="center" gap="12">
			<Flex align="center" justify="center" :class="$style.activity_icon">
				<Icon :name="icon" size="16" color="primary" />

				<Icon name="check-circle" size="14" color="green" :class="$style.check_icon" />
			</Flex>

			<Flex direction="column" gap="6">
				<Text size="13" weight="600" color="primary">
					{{ title }}
				</Text>
				<Text size="12" weight="500" color="tertiary">
					{{ DateTime.fromSeconds(tx.updatedAt / 1_000).toFormat("LLL dd, hh:mm") }}
				</Text>
			</Flex>
		</Flex>

		<Flex v-if="type === 'transfer' && token" align="center" :class="$style.amount_badge">
			<Text size="12" weight="600" color="primary">
				{{ comma(transferAmount) }}
				<Text color="tertiary">{{ token.symbol }}</Text>
			</Text>
		</Flex>
		<Flex v-if="type === 'mint'" align="center" :class="$style.amount_badge">
			<Text size="12" weight="600" color="primary">
				{{ comma(mintAmount) }}
			</Text>
		</Flex>
	</Flex>
</template>

<style module>
.wrapper {
	cursor: pointer;
	border-radius: 8px;

	padding: 8px;

	transition: all 0.2s var(--bezier);

	&:hover {
		background: var(--gray-3);
	}

	&:active {
		background: var(--gray-5);
	}
}

.activity_icon {
	position: relative;

	width: 32px;
	height: 32px;

	border-radius: 50%;
	background: linear-gradient(var(--gray-8), var(--gray-3));
}

.check_icon {
	position: absolute;
	top: -8px;
	right: -8px;

	box-sizing: content-box;
	border: 3px solid var(--card-bg);
	border-radius: 50%;
}

.amount_badge {
	background: var(--gray-5);
	border-radius: 6px;

	padding: 4px 6px;
}
</style>
