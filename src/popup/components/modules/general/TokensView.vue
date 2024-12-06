<script setup>
/** Components */
import TokenCard from "./TokenCard.vue"

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
				:class="['clickable', $style.txt_button]"
			>
				Manage
			</Text>
		</Flex>

		<template v-if="appStore.tokens.length">
			<Flex direction="column" gap="6">
				<TokenCard v-for="token in appStore.tokens" :token />
			</Flex>
		</template>
		<template v-else>
			<Button @click="popupStore.open('new_token')" type="secondary" size="small" leftIcon="plus-circle">
				New token
			</Button>
		</template>
	</Flex>
</template>

<style module>
.txt_button {
	transition: all 0.2s var(--bezier);

	&:hover {
		color: var(--txt-secondary);
	}
}
</style>
