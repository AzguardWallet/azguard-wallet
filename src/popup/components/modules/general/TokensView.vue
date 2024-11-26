<script setup>
/** Store */
import { useAppStore } from "@/stores/app.store"
import { usePopupStore } from "@/stores/popup.store"
const appStore = useAppStore()
const popupStore = usePopupStore()
</script>

<template>
	<Flex direction="column" gap="12">
		<Flex align="center" justify="between">
			<Text size="13" weight="600" color="secondary"> Tokens </Text>
			<Text
				@click="popupStore.open('tokens')"
				size="12"
				weight="600"
				color="tertiary"
				class="clickable"
			>
				Manage
			</Text>
		</Flex>

		<template v-if="appStore.tokens.length">
			<Flex
				v-for="token in appStore.tokens"
				align="center"
				justify="between"
				:class="$style.card"
			>
				<Flex align="center" gap="12">
					<Flex
						align="center"
						justify="center"
						:class="$style.token_icon"
					>
						<Icon name="aztec" size="20" color="primary" />
					</Flex>

					<Flex direction="column" gap="6">
						<Text size="13" weight="600" color="primary">AZT</Text>
						<Text size="12" weight="500" color="tertiary">
							Aztec Network
						</Text>
					</Flex>
				</Flex>

				<Flex direction="column" align="end" gap="6">
					<Text size="13" weight="600" color="primary">0</Text>
					<Text size="13" weight="600" color="tertiary">$0.00</Text>
				</Flex>
			</Flex>
		</template>
		<template v-else>
			<Flex align="center" justify="between" :class="$style.empty">
				<Text size="13" weight="500" color="tertiary">
					No available tokens
				</Text>
				<Text
					@click="popupStore.open('new_token')"
					size="12"
					weight="600"
					color="blue"
					class="clickable"
				>
					Add token
				</Text>
			</Flex>
		</template>
	</Flex>
</template>

<style module>
.card {
	background: var(--card-bg);
	border: 1px solid var(--border);
	box-shadow: 0 1px 2px transparent;
	border-radius: 12px;
	cursor: pointer;

	padding: 12px;

	transition: all 0.2s var(--bezier);

	&:hover {
		border-color: var(--border-hovered);
		box-shadow: 0 1px 2px var(--shadow-5);
	}
}

.token_icon {
	width: 32px;
	height: 32px;

	border-radius: 8px;
	background: var(--gray-5);
	box-sizing: border-box;
}

.empty {
	border-radius: 12px;
	box-shadow: inset 0 0 0 1px var(--border);

	padding: 12px;
}
</style>
