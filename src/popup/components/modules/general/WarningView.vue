<script setup>
/** Stores */
import { useAppStore } from "@/stores/app.store"

/** Utils */
import { CHAIN_IDS } from "@/components/ui/utils"

const appStore = useAppStore()

const { handleExternalLink } = useExternalLink()

const reportIssueUrl = "https://azguardwallet.io/forms/report-issue"

const isAlphanet = computed(() => appStore.network?.chainId === CHAIN_IDS.ALPHANET)
const networkLabel = computed(() => `Aztec ${appStore.network?.name ?? ""}`)
</script>

<template>
	<Flex gap="8" :class="$style.wrapper">
		<Icon name="warning" size="16" color="orange" />
		<Flex direction="column" gap="6">
			<template v-if="isAlphanet">
				<Text size="13" weight="600" color="primary"> Use Aztec Alphanet with caution. </Text>
				<Text size="12" weight="600" color="tertiary">
					The protocol is in the &ldquo;alpha&rdquo; stage, and there is a risk of losing all your funds.
				</Text>
			</template>
			<template v-else>
				<Text size="13" weight="600" color="primary"> {{ networkLabel }} </Text>
			</template>
			<Text size="12" weight="600" color="tertiary">
				If you're facing a bug -
				<a
					:href="reportIssueUrl"
					target="_blank"
					rel="noopener noreferrer"
					@click="handleExternalLink($event, reportIssueUrl)"
				>
					report an issue
				</a>
			</Text>
		</Flex>
	</Flex>
</template>

<style module>
.wrapper {
	border-radius: 12px;

	background: repeating-linear-gradient(
		-45deg,
		var(--gray-3),
		var(--gray-3) 5px,
		var(--gray-8) 5px,
		var(--gray-8) 10px
	);
	box-shadow: 0 0 0 3px var(--gray-3);

	padding: 12px;
}
</style>
