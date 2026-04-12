<script setup>
import { Config } from "@/wallet/config"
import { LogLevel } from "@/wallet/logger"
import { LogViewerServiceClient } from "@/wallet/services/log-viewer/client"
import { ConfigServiceClient } from "@/wallet/services/config/client"
import { TaskServiceClient } from "@/wallet/services/task/client"

/** Store */
import { useAppStore } from "@/stores/app.store"
import { useCacheStore } from "@/stores/cache.store"
import { usePopupStore } from "@/stores/popup.store"
const appStore = useAppStore()
const cacheStore = useCacheStore()
const popupStore = usePopupStore()

const logViewerService = new LogViewerServiceClient()
logViewerService.onLog.add(onLogAdded)

const configService = new ConfigServiceClient()
configService.onUpdate.add(onSettingUpdate)

const defaultConfig = new Config()
const indicateFailures = ref(defaultConfig.indicateFailures)
const showNode = ref(defaultConfig.showNode)
const stealthMode = ref(defaultConfig.stealthMode)

const HEADER_INDICATION_DURATION = 5_000
let headerIndicateFailureTimer = null
let headerIndicateTaskTimer = null

const MENU_INDICATION_DURATION = 60_000
let menuIndicateFailureTimer = null
let menuIndicateTaskTimer = null

const tasks = ref([])
const activeTasksCount = ref(0)
const taskService = new TaskServiceClient()
taskService.onTaskCreated.add(onTaskCreated)
taskService.onTaskUpdated.add(onTaskUpdated)
taskService.onTaskDeleted.add(processTask)
async function onTaskCreated(task) {
	if (task.parentId) return

	tasks.value.push(task)
}
function processTask(task) {
	const idx = tasks.value.findIndex((t) => t.id === task.id)
	if (idx !== -1) {
		tasks.value.splice(idx, 1)
	}
}
function onTaskUpdated(task) {
	if (!task.finishedAt || task.parentId) return

	processTask(task)
}

const currentFailureType = ref("")
const highlightColor = computed(() => {
	if (currentFailureType.value === "error") {
		return "var(--red)"
	} else if (currentFailureType.value === "warning") {
		return "var(--yellow)"
	} else if (activeTasksCount.value) {
		return "" // "var(--green)"
	} else {
		return ""
	}
})

function handleWalletFailure(type, logId) {
	currentFailureType.value = type

	// Header
	if (headerIndicateFailureTimer) {
		clearTimeout(headerIndicateFailureTimer)
		headerIndicateFailureTimer = null
	}

	headerIndicateFailureTimer = setTimeout(() => {
		currentFailureType.value = ""
		activeTasksCount.value = tasks.value?.length || 0
		cacheStore.activeTasksCount = activeTasksCount.value
		headerIndicateFailureTimer = null
	}, HEADER_INDICATION_DURATION)

	// Menu
	if (menuIndicateFailureTimer) {
		clearTimeout(menuIndicateFailureTimer)
		menuIndicateFailureTimer = null
	}
	cacheStore.failureLog = {
		id: logId,
		color: highlightColor.value,
	}

	menuIndicateFailureTimer = setTimeout(() => {
		cacheStore.failureLog = null
		menuIndicateFailureTimer = null
	}, MENU_INDICATION_DURATION)
}

function onLogAdded(log) {
	switch (log.level) {
		case LogLevel.Warn:
			handleWalletFailure("warning", log.id)
			break
		case LogLevel.Error:
			handleWalletFailure("error", log.id)
			break

		default:
			break
	}
}

function onSettingUpdate(setting) {
	switch (setting.key) {
		case "indicateFailures":
			indicateFailures.value = setting.value
			break
		case "showNode":
			showNode.value = setting.value
			break
		case "stealthMode":
			stealthMode.value = setting.value
			break

		default:
			break
	}
}

const handleOpenPopup = (target) => {
	if (!appStore.isLogined) return
	popupStore.open(target)
}

watch(
	() => indicateFailures.value,
	() => {
		if (!indicateFailures.value) {
			logViewerService.disconnect()
		} else {
			logViewerService.connect()
		}
	},
)
watch(
	() => tasks.value?.length,
	(newValue) => {
		if (!newValue) {
			if (headerIndicateTaskTimer) {
				clearTimeout(headerIndicateTaskTimer)
				headerIndicateTaskTimer = null
			}

			headerIndicateTaskTimer = setTimeout(() => {
				activeTasksCount.value = 0
				headerIndicateTaskTimer = null
			}, HEADER_INDICATION_DURATION)

			menuIndicateTaskTimer = setTimeout(() => {
				cacheStore.activeTasksCount = null
				menuIndicateTaskTimer = null
			}, MENU_INDICATION_DURATION)

			return
		}

		if (menuIndicateTaskTimer) {
			clearTimeout(menuIndicateTaskTimer)
			menuIndicateTaskTimer = null
		}

		activeTasksCount.value = newValue
		cacheStore.activeTasksCount = newValue
	},
)

onMounted(async () => {
	indicateFailures.value = await configService.getValue("indicateFailures")
	showNode.value = await configService.getValue("showNode")
	stealthMode.value = await configService.getValue("stealthMode")

	tasks.value = (await taskService.getTasks()).filter((t) => !t.parentId && !t.finishedAt)
	activeTasksCount.value = tasks.value?.length

	if (indicateFailures.value) {
		logViewerService.connect()
	}
})

onBeforeUnmount(() => {
	configService.disconnect()
	logViewerService.disconnect()
	taskService.disconnect()
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
				highlightColor && $style['logs_indicator--visible'],
				!appStore.isLogined && $style.disabled
			]"
			:style="highlightColor ? { '--highlight-color': highlightColor } : {}"
		>
			<Icon name="logo" size="14" color="primary" />
			<div v-if="stealthMode" :class="$style.stealth_badge">
				<Icon name="eye-off" size="10" color="primary" />
			</div>
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
					• &nbsp;{{ getChainName(appStore.network?.chainId) }}
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
				data-testid="network-button"
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

.stealth_badge {
	position: absolute;
	bottom: -4px;
	right: -4px;

	display: flex;
	align-items: center;
	justify-content: center;

	width: 16px;
	height: 16px;

	border-radius: 50%;
	background: var(--purple);
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
