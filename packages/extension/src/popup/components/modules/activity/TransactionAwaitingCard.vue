<script setup>
defineProps({
	title: { type: String, default: "Creating transaction" },
	subtitle: { type: String, default: "Estimating fees, generating proofs..." },
	/** Optional: when provided, the card renders in TransactionCard shape:
	 *  icon square on the left + amount column on the right. UI-initiated
	 *  transfers pass these; dapp tasks fall back to the minimalist spinner. */
	icon: { type: String, default: null },
	amount: { type: String, default: null },
	amountSymbol: { type: String, default: null },
})
</script>

<template>
	<Flex align="center" justify="between" gap="10" :class="$style.wrapper">
		<Flex align="center" gap="16" :class="$style.left_content">
			<Flex align="center" justify="center" :class="$style.activity_icon">
				<template v-if="icon">
					<Icon :name="icon" size="18" color="secondary" />
					<div :class="$style.spinner_badge">
						<Spinner size="10" color="--nulo-accent" />
					</div>
				</template>
				<Spinner v-else size="18" color="--txt-primary" />
			</Flex>

			<Flex direction="column" gap="4" :class="$style.text">
				<span :class="$style.tx_title">{{ title }}</span>
				<span :class="$style.tx_subtitle">{{ subtitle }}</span>
			</Flex>
		</Flex>

		<Flex v-if="amount" direction="column" align="end" gap="2" :class="$style.amount_col">
			<span :class="$style.tx_amount">{{ amount }}</span>
			<span v-if="amountSymbol" :class="$style.tx_amount_symbol">{{ amountSymbol }}</span>
		</Flex>
	</Flex>
</template>

<style module>
.wrapper {
	padding: 8px 0;
}

.left_content {
	min-width: 0;
}

.activity_icon {
	position: relative;
	flex-shrink: 0;

	width: 40px;
	height: 40px;

	background: var(--nulo-surface-low);
	border: 1px solid rgba(74, 70, 63, 0.3);
}

.spinner_badge {
	position: absolute;
	top: -6px;
	right: -6px;

	display: flex;
	align-items: center;
	justify-content: center;

	box-sizing: content-box;
	background: var(--app-bg);
	border: 2px solid var(--app-bg);
	border-radius: 50%;
}

.text {
	min-width: 0;
}

.tx_title {
	font-family: var(--font-headline);
	font-weight: 700;
	font-size: 14px;
	letter-spacing: -0.02em;
	color: var(--txt-primary);
}

.tx_subtitle {
	font-family: var(--font-mono);
	font-size: 10px;
	color: var(--nulo-secondary);
}

.amount_col {
	flex-shrink: 0;
}

.tx_amount {
	font-family: var(--font-mono);
	font-size: 14px;
	font-weight: 500;
	color: var(--txt-primary);
}

.tx_amount_symbol {
	font-family: var(--font-mono);
	font-size: 10px;
	color: var(--nulo-outline);
}
</style>
