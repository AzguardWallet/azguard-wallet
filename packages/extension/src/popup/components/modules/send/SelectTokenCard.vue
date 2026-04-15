<script setup>
/** Store */
import { usePopupStore } from "@/stores/popup.store"
const popupStore = usePopupStore()

const props = defineProps({
	token: {
		type: Object,
	},
})

const isTokenRestricted = computed(() => {
	if (!props.token) return
	return !props.token.hasPrivateTransfers || !props.token.hasPublicTransfers
})
const isTokenBlocked = computed(() => {
	return !props.token.hasPrivateTransfers && !props.token.hasPublicTransfers
})

const handleSelectToken = () => {
	if (!props.token) {
		popupStore.open("new_token")
	} else {
		popupStore.open("select_token")
	}
}
</script>

<template>
	<Flex @click="handleSelectToken" align="center" justify="between" :class="$style.wrapper" data-testid="send-token-trigger">
		<template v-if="token">
			<Flex align="center" gap="16">
				<Flex align="center" justify="center" :class="$style.token_icon_box">
					<span :class="$style.token_initial">{{ token.symbol?.charAt(0) }}</span>
					<Icon v-if="isTokenBlocked" name="warning" size="10" color="red" :class="$style.type_icon" />
				</Flex>

				<Flex direction="column" gap="2">
					<span :class="$style.token_symbol">{{ token.symbol }}</span>
					<span :class="$style.token_name">{{ token.name }}</span>
				</Flex>
			</Flex>

			<MaterialIcon name="chevron_right" :size="20" color="primary" />
		</template>

		<Flex v-else wide align="center" justify="between">
			<Flex align="center" gap="8">
				<Icon name="info" size="16" color="orange" />
				<Text size="13" weight="600" color="secondary"> No available tokens </Text>
			</Flex>

			<span :class="$style.import_link">Import token</span>
		</Flex>
	</Flex>
</template>

<style module>
.wrapper {
	width: 100%;

	cursor: pointer;

	padding: 12px 0;

	transition: all 0.2s var(--bezier);

	&:hover {
		background: rgba(29, 27, 26, 0.5);
	}
}

.token_icon_box {
	position: relative;
	width: 40px;
	height: 40px;
	flex-shrink: 0;

	background: var(--nulo-accent);
}

.token_initial {
	font-family: var(--font-headline);
	font-weight: 700;
	font-size: 18px;
	color: #0a0908;
}

.type_icon {
	position: absolute;
	top: -4px;
	right: -4px;

	box-sizing: content-box;
	background: var(--app-bg);
	padding: 1px;
}

.token_symbol {
	font-family: var(--font-headline);
	font-weight: 700;
	font-size: 18px;
	color: var(--txt-primary);
}

.token_name {
	font-family: var(--font-mono);
	font-size: 10px;
	text-transform: uppercase;
	color: var(--nulo-secondary);
}

.import_link {
	font-family: var(--font-headline);
	font-size: 12px;
	font-weight: 700;
	text-transform: uppercase;
	letter-spacing: 0.05em;
	color: var(--nulo-accent);
}
</style>
