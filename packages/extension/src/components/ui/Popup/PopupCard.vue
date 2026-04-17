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
		:class="[$style.wrapper, large && $style.large, displaceIdx > 1 && $style.displace]"
		:style="{
			'--displace': displaceIdx - 1,
			flex: showFullscreen ? '10' : null,
		}"
	>
		<div @click="showFullscreen = !showFullscreen" :class="$style.handle_zone">
			<div :class="$style.bar" />
		</div>

		<Flex direction="column" gap="16" wide :style="{ minHeight: 0 }">
			<slot />
		</Flex>
	</Flex>
</template>

<style module>
.wrapper {
	overflow: auto;

	background: var(--nulo-surface);
	border-top: 2px solid var(--nulo-accent);

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

.handle_zone {
	display: flex;
	align-items: center;
	justify-content: center;

	width: 100%;
	padding: 10px 0 14px 0;

	cursor: pointer;
}

.bar {
	width: 40px;
	height: 3px;

	background: var(--nulo-outline);

	transition: background 0.2s var(--bezier);
}

.handle_zone:hover .bar {
	background: var(--nulo-secondary);
}

.handle_zone:active .bar {
	background: var(--nulo-accent);
}
</style>
