<script setup>
/** Store */
import { useAppStore } from "@/stores/app.store"
import { usePopupStore } from "@/stores/popup.store"
import { useCacheStore } from "@/stores/cache.store"
const appStore = useAppStore()
const popupStore = usePopupStore()
const cacheStore = useCacheStore()

const selectedToken = computed(() => {
	if (cacheStore.activeTokenIdx)
		// biome-ignore lint/suspicious/noDoubleEquals: <explanation>
		return appStore.tokens.find((t) => t.id == cacheStore.activeTokenIdx)
	return appStore.tokens[0]
})
const isTokenRestricted = computed(() => {
	if (!selectedToken.value) return

	return (
		!selectedToken.value.hasPrivateTransfers ||
		!selectedToken.value.hasPublicTransfers
	)
})

const handleSelectToken = () => {
	if (!selectedToken.value) return
	popupStore.open("select_token")
}
</script>

<template>
	<Flex
		@click="handleSelectToken"
		align="center"
		justify="between"
		:class="$style.wrapper"
	>
		<template v-if="selectedToken">
			<Flex align="center" gap="8">
				<Tooltip :disabled="!isTokenRestricted" position="start">
					<Flex
						align="center"
						justify="center"
						:class="$style.token_icon"
					>
						<Icon name="banknote" size="16" color="primary" />
						<Icon
							v-if="isTokenRestricted"
							:name="
								!selectedToken.hasPrivateTransfers
									? 'face'
									: 'key-square'
							"
							size="10"
							:color="
								!selectedToken.hasPrivateTransfers
									? 'orange'
									: 'green'
							"
							:class="$style.type_icon"
						/>
					</Flex>

					<template #content>
						Restricted token, only
						{{
							selectedToken.hasPrivateTransfers
								? "private"
								: "public"
						}}
						transfers
					</template>
				</Tooltip>

				<Text size="13" weight="600" color="primary">
					{{ selectedToken.symbol }}
				</Text>
				<Text size="13" weight="600" color="body">
					{{ selectedToken.name }}
				</Text>
			</Flex>

			<Icon
				name="chevron"
				size="16"
				color="primary"
				style="transform: rotate(-90deg)"
			/>
		</template>

		<Flex v-else wide justify="center" align="center" gap="8">
			<Icon name="banknote" size="16" color="secondary" />
			<Text size="13" weight="600" color="tertiary">
				No available tokens
			</Text>
		</Flex>
	</Flex>
</template>

<style module>
.wrapper {
	width: 100%;

	background: var(--card-bg);
	box-shadow: inset 0 0 0 1px var(--gray-10), 0 1px 2px var(--shadow-5);
	border-radius: 12px;
	cursor: pointer;

	padding: 12px;

	transition: all 0.2s var(--bezier);

	&:hover {
		background: var(--gray-5);
	}
}

.token_icon {
	position: relative;
}

.type_icon {
	position: absolute;
	top: -5px;
	right: -5px;

	box-sizing: content-box;
	background: var(--card-bg);
	border-radius: 3px;

	padding: 1px;
}
</style>
