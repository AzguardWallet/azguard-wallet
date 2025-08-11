<script setup>
/** Utils */
import { SettingServiceClient } from "@/wallet/services/settings/client"
import { DEFAULT_SETTINGS } from "@/wallet/services/settings/defaults"

const props = defineProps({
	large: {
		type: Boolean,
		default: false,
	},
	displaceIdx: {
		type: Number,
	},
})

let settingService = null
const showFullscreen = ref(DEFAULT_SETTINGS?.appearance?.showPopupFullscreen)

function onSettingUpdate(setting) {
	if (setting.key === "showPopupFullscreen") {
		showFullscreen.value = setting.value
	}
}

onMounted(async () => {
	settingService = new SettingServiceClient(undefined, undefined, onSettingUpdate)
	if (window.innerHeight > 600) {
		showFullscreen.value = true
	}
})

onBeforeUnmount(() => {
	settingService.dispose()
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
	border-top-left-radius: 24px;
	border-top-right-radius: 24px;

	overflow: auto;

	background: var(--card-bg);
	box-shadow: 0 0 0 1px var(--border), 0 -6px 16px var(--shadow-5);

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
	height: 4px;

	cursor: pointer;
	border-radius: 50px;
	background: var(--gray-20);

	transition: all 0.2s var(--bezier);

	&:hover {
		background: var(--txt-tertiary);
	}

	&:active {
		background: var(--txt-primary);
	}
}
</style>
