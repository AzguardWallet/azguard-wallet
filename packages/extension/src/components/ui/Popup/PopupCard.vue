<script setup>
/** Utils */
import { Config } from "@/wallet/config"
import { ConfigServiceClient } from "@/wallet/services/config/client"

const props = defineProps({
	large: {
		type: Boolean,
		default: false,
	},
	displaceIdx: {
		type: Number,
	},
})

const configService = new ConfigServiceClient()
configService.onUpdate.add(onSettingUpdate)

const showFullscreen = ref(new Config().showPopupFullscreen)

function onSettingUpdate(setting) {
	if (setting.key === "showPopupFullscreen") {
		showFullscreen.value = setting.value
	}
}

onMounted(async () => {
	showFullscreen.value = await configService.getValue("showPopupFullscreen")
	if (window.innerHeight > 600) {
		showFullscreen.value = true
	}
})

onBeforeUnmount(() => {
	configService.disconnect()
})
</script>

<template>
	<Flex
		align="center"
		direction="column"
		gap="12"
		:class="[$style.wrapper, large && $style.large, displaceIdx > 1 && $style.displace]"
		:style="{
			'--displace': displaceIdx - 1,
			flex: showFullscreen ? '10' : null,
		}"
	>
		<div @click="showFullscreen = !showFullscreen" :class="$style.bar" />

		<Flex direction="column" gap="16" wide :style="{ minHeight: 0 }">
			<slot />
		</Flex>
	</Flex>
</template>

<style module>
.wrapper {
	overflow: auto;

	background: var(--nulo-surface);
	border-top: 1px solid var(--nulo-border);

	padding-top: 10px;

	transition: all 0.2s var(--bezier);

	&.large {
		flex: 10;
	}

	&.displace {
		transform: translateY(15px);
	}

	&::-webkit-scrollbar {
		display: none;
	}
}

.bar {
	width: 32px;
	height: 2px;

	cursor: pointer;
	background: var(--nulo-outline);

	transition: all 0.2s var(--bezier);

	&:hover {
		background: var(--nulo-secondary);
	}

	&:active {
		background: var(--nulo-accent);
	}
}
</style>
