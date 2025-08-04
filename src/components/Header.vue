<script setup>
/** Utils */
import { getChainName } from "@/components/ui/utils.js"
import { LoggerServiceClient } from "@/wallet/services/logger/client"
import { SettingServiceClient } from "@/wallet/services/settings/client"
import { DEFAULT_SETTINGS } from "@/wallet/services/settings/defaults"

/** Store */
import { useAppStore } from "@/stores/app.store"
import { usePopupStore } from "@/stores/popup.store"
const appStore = useAppStore()
const popupStore = usePopupStore()

let loggerService = null
let settingService = null

const indicateFailures = ref(DEFAULT_SETTINGS?.developer?.indicateFailures)
const showNode = ref(DEFAULT_SETTINGS?.appearance?.showNode)

const highlightColor = ref("")
const isLogsHighlighted = ref(false)
const INDICATION_DURATION = 5_000
let highlightTimer = null

function setHighlightColor(color) {
	if (highlightTimer) {
		clearTimeout(highlightTimer)
		highlightTimer = null
	}

	highlightColor.value = color
	isLogsHighlighted.value = true

	highlightTimer = setTimeout(() => {
		isLogsHighlighted.value = false
		highlightTimer = null
	}, INDICATION_DURATION)
}

function onLogAdded(log) {
	switch (log.level.toUpperCase()) {
		case "WARN":
			setHighlightColor("var(--yellow)")
			break;
		case "ERROR":
			setHighlightColor("var(--red)")
			break;

		default:
			break;
	}
}

function onSettingUpdate(setting) {
	switch (setting.key) {
		case "indicateFailures":
			indicateFailures.value = setting.value
			break;
		case "showNode":
			showNode.value = setting.value
			break;
	
		default:
			break;
	}
}

const handleOpenPopup = target => {
	if (!appStore.isLogined) return
	popupStore.open(target)
}

watch(
	() => indicateFailures.value,
	() => {
		if (!indicateFailures.value && loggerService) {
			loggerService.dispose()
		} else if (indicateFailures.value) {
			loggerService = new LoggerServiceClient(undefined, undefined, onLogAdded)
		}
	}
)

onMounted(async () => {
	settingService = new SettingServiceClient(undefined, undefined, onSettingUpdate)
	indicateFailures.value = (await settingService.getSetting("indicateFailures"))?.value
	showNode.value = (await settingService.getSetting("showNode"))?.value
	
	if (indicateFailures.value) {
		loggerService = new LoggerServiceClient(undefined, undefined, onLogAdded)
	}
})

onBeforeUnmount(() => {
	loggerService?.dispose()
	settingService?.dispose()
})
</script>

<template>
	<Flex v-if="!appStore._isHomeScreenOpened" align="center" justify="between" :class="$style.wrapper">
		<Flex
			v-if="appStore.isLogined"
			@click="handleOpenPopup('menu')"
			align="center"
			justify="center"
			:class="[
				$style.button,
				$style.logs_indicator,
				isLogsHighlighted && $style['logs_indicator--visible'],
				!appStore.isLogined && $style.disabled
			]"
			:style="highlightColor ? { '--highlight-color': highlightColor } : {}"
		>
			<Icon name="logo" size="14" color="primary" />
		</Flex>

		<Flex align="center" gap="8">
			<Flex
				v-if="appStore.isLogined"
				@click="handleOpenPopup('accounts')"
				align="center"
				gap="6"
				:class="$style.account"
			>
				<Icon name="vault" size="18" color="primary" />

				<Text size="13" weight="600" color="primary" :class="$style.account_name">
					{{ appStore.account?.name }}
				</Text>

				<Text
					v-if="showNode"
					size="13"
					weight="600"
					color="tertiary"
					:class="$style.network_type"
				>
					• &nbsp;{{ getChainName(appStore.network.chainId) }}
				</Text>

				<Icon name="chevron" size="12" color="secondary" />
			</Flex>
		</Flex>

		<Tooltip side="left">
			<Flex
				v-if="appStore.isLogined"
				@click="handleOpenPopup('networks')"
				align="center"
				justify="center"
				:class="[$style.button, !appStore.isLogined && $style.disabled]"
			>
				<Icon name="globe" size="18" color="primary" />
				<div :class="[$style.dot, $style[String(appStore.networkStatus).toLowerCase()]]" />
			</Flex>

			<template #content>
				<Flex align="center" gap="2">
					<Text size="12" color="secondary">Node status:</Text>
					<Text size="12" :class="$style[String(appStore.networkStatus).toLowerCase()]">
						{{ appStore.networkStatus }}
					</Text>
				</Flex>
			</template>
		</Tooltip>
	</Flex>
</template>

<style module>
.wrapper {
	height: 48px;
	min-height: 48px;

	padding: 0 20px;
}

.button {
	position: relative;

	min-width: 28px;
	min-height: 28px;

	cursor: pointer;
	border-radius: 50%;
	background: var(--card-bg);
	box-shadow: inset 0 0 0 1px var(--border);

	padding: 4px;

	transition: all 0.2s var(--bezier);

	&:hover {
		background: var(--gray-15);
		box-shadow: inset 0 0 0 1px var(--border-hovered);
	}

	&:active {
		background: var(--gray-20);
	}

	&.disabled {
		opacity: 0.5;
		pointer-events: none;
	}
}

.logs_indicator::before {
	content: "";
	position: absolute;
	top: -2px;
	left: -2px;
	right: -2px;
	bottom: -2px;
	z-index: -1;

	border-radius: 50%;
	background: radial-gradient(
		circle,
		transparent 40%,
		var(--highlight-color) 80%,
		transparent 100%
	);

	opacity: 0;
	transition: opacity 1s ease;
	animation: pulse 2.5s infinite ease-in-out;
}

.logs_indicator--visible::before {
	opacity: 1;
}

@keyframes pulse {
	0%, 100% {
		filter: brightness(0.7);
	}

	50% {
		filter: brightness(1.1);
	}
}

@keyframes loading {
	0% {
		opacity: 1;
	}

	25% {
		opacity: 0.8;
	}

	50% {
		opacity: 0.4;
	}

	70% {
		opacity: 0.8;
	}

	100% {
		opacity: 1;
	}
}

.dot {
	position: absolute;
	top: 5px;
	right: 5px;

	width: 5px;
	height: 5px;
	box-sizing: content-box;

	box-shadow: 0 0 0 2px var(--card-bg);

	border-radius: 50%;
	background: var(--gray);

	&.active {
		background: var(--green);
	}
	&.inactive {
		background: var(--red);
	}
	&.invalidchain {
		background: var(--red);
	}
	&.sync {
		background: var(--gray);
		animation: loading 1.5s infinite linear;
	}
}

.active {
	color: var(--green);
}
.inactive {
	color: var(--red);
}
.invalidchain {
	color: var(--red);
}
.sync {
	color: var(--gray);
	animation: loading 1.5s infinite linear;
}

.account {
	height: 28px;

	border-radius: 50px;
	background: var(--card-bg);
	box-shadow: inset 0 0 0 1px var(--border);
	cursor: pointer;

	padding: 0 10px 0 6px;

	transition: all 0.2s var(--bezier);

	&:hover {
		box-shadow: inset 0 0 0 1px var(--border-hovered);
	}
}

.account_name {
	max-width: 90px;

	text-wrap: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.network_type {
	max-width: 90px;

	text-wrap: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}
</style>
