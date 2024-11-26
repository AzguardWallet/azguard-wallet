<script setup>
/** Components */
import Navigation from "../../../components/Navigation.vue"

/** Store */
import { usePopupStore } from "@/stores/popup.store"
const popupStore = usePopupStore()
</script>

<template>
	<Flex direction="column" gap="20" :class="$style.wrapper">
		<Flex align="center" gap="8">
			<RouterLink to="/popup/settings/security">
				<Text
					size="13"
					weight="600"
					color="tertiary"
					style="line-height: 16px"
				>
					Security
				</Text>
			</RouterLink>
			<Text color="support">•</Text>
			<Text
				size="13"
				weight="600"
				color="tertiary"
				style="line-height: 16px"
			>
				Wallet
			</Text>
		</Flex>

		<Flex direction="column" gap="24">
			<Flex direction="column" gap="12">
				<Flex direction="column" gap="6">
					<Text size="13" weight="600" color="primary">
						Full wallet reset
					</Text>
					<Text size="12" weight="500" height="140" color="tertiary">
						Your wallet can't be restored if you didn't save the
						seed phrase
					</Text>
				</Flex>

				<Button
					@click="popupStore.open('reset')"
					type="red"
					size="small"
					>Reset Wallet</Button
				>
			</Flex>
		</Flex>

		<Navigation />
	</Flex>
</template>

<style module>
.wrapper {
	flex: 1;

	background: var(--card-bg);
	box-shadow: 0 0 0 1px var(--gray-5);

	border-top-left-radius: 24px;
	border-top-right-radius: 24px;

	padding: 20px 24px 24px 24px;
}

.item {
	border-radius: 12px;
	box-shadow: inset 0 0 0 1px var(--gray-10);
	cursor: pointer;

	padding: 12px;

	transition: all 0.2s var(--bezier);

	&:hover {
		background: var(--gray-3);

		& .item_icon {
			transform: rotate(-90deg) translateY(3px);
		}
	}

	&:active {
		background: var(--gray-5);
	}
}

.item_icon {
	transform: rotate(-90deg);

	transition: transform 0.2s var(--bezier);
}
</style>
