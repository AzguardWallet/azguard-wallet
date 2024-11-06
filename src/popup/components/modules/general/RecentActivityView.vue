<script setup>
/** Store */
import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()
</script>

<template>
	<Flex direction="column" gap="16" :class="$style.wrapper">
		<Flex align="center" justify="between">
			<Text size="13" weight="600" color="secondary">
				Recent activity
			</Text>
			<Text size="12" weight="600" color="tertiary" class="clickable">
				View all
			</Text>
		</Flex>

		<div :class="$style.list">
			<Flex align="center" gap="12" :class="$style.item">
				<Flex
					align="center"
					justify="center"
					:class="$style.activity_icon"
				>
					<Icon name="wallet" size="16" color="primary" />
				</Flex>

				<Flex direction="column" gap="6">
					<Text size="13" weight="600" color="primary">
						Wallet created
					</Text>
					<Text size="12" weight="500" color="tertiary">
						{{
							new Date(
								appStore._wallet.created_at
							).toLocaleString()
						}}
					</Text>
				</Flex>
			</Flex>
		</div>
	</Flex>
</template>

<style module>
.wrapper {
	margin-bottom: 80px;
}

.list {
	margin: -8px;
}

.item {
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
	width: 32px;
	height: 32px;

	border-radius: 50%;
	background: linear-gradient(var(--gray-5), var(--gray-3));
	box-shadow: inset 0 0 0 1px var(--gray-5);
}
</style>
