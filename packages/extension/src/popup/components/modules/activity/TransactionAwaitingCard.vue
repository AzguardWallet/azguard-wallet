<script setup>
defineProps({
	title: { type: String, default: "Creating transaction" },
	subtitle: { type: String, default: "Estimating fees, generating proofs..." },
})
</script>

<template>
	<Flex wide align="center" gap="16" :class="$style.wrapper">
		<Flex align="center" justify="center" :class="$style.activity_icon">
			<Spinner size="18" color="--txt-primary" />
		</Flex>

		<Flex direction="column" gap="4" :class="$style.text">
			<span :class="$style.tx_title">{{ title }}</span>
			<span :class="$style.tx_subtitle">{{ subtitle }}</span>
		</Flex>
	</Flex>
</template>

<style module>
.wrapper {
	padding: 8px 0;
}

.activity_icon {
	flex-shrink: 0;

	width: 40px;
	height: 40px;

	background: var(--nulo-surface-low);
	border: 1px solid rgba(74, 70, 63, 0.3);
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
</style>
