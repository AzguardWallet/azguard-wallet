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
	<header v-if="!appStore._isHomeScreenOpened" :class="$style.wrapper">
		<Flex
			v-if="appStore.isLogined"
			@click="handleOpenPopup('accounts')"
			direction="column"
			data-testid="account-selector"
			:class="$style.account_info"
		>
			<span :class="$style.account_label">
				{{ appStore.account?.name?.toUpperCase() || "PRIMARY ACCOUNT" }}
			</span>
			<span :class="$style.account_address">
				{{ appStore.account?.address ? `${appStore.account.address.slice(0, 6)}...${appStore.account.address.slice(-4)}` : "" }}
			</span>
		</Flex>

		<Flex align="center" gap="16">
			<Flex
				v-if="appStore.isLogined"
				@click="handleOpenPopup('networks')"
				align="center"
				justify="center"
				data-testid="network-button"
				:class="$style.icon_button"
			>
				<div :class="[$style.status_dot, $style[String(appStore.networkStatus).toLowerCase()]]" />
			</Flex>

			<Flex
				v-if="appStore.isLogined"
				@click="handleOpenPopup('menu')"
				align="center"
				justify="center"
				data-testid="menu-button"
				:class="$style.icon_button"
			>
				<MaterialIcon name="menu" :size="20" color="primary" />
			</Flex>
		</Flex>
	</header>
</template>

<style module>
.wrapper {
	display: flex;
	align-items: center;
	justify-content: space-between;

	height: 64px;
	min-height: 64px;

	padding: 0 24px;
	background: var(--app-bg);
}

.account_info {
	cursor: pointer;
	gap: 2px;
}

.account_label {
	font-family: var(--font-headline);
	font-size: 12px;
	font-weight: 700;
	letter-spacing: -0.04em;
	text-transform: uppercase;
	color: var(--nulo-secondary);
}

.account_address {
	font-family: var(--font-headline);
	font-size: 14px;
	font-weight: 700;
	letter-spacing: -0.02em;
	color: var(--txt-primary);
}

.icon_button {
	width: 36px;
	height: 36px;

	cursor: pointer;

	transition: background 0.2s var(--bezier);

	&:hover {
		background: var(--nulo-surface-high);
	}

	&:active {
		opacity: 0.8;
	}
}

.status_dot {
	width: 8px;
	height: 8px;
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

@keyframes loading {
	0% { opacity: 1; }
	50% { opacity: 0.4; }
	100% { opacity: 1; }
}
</style>
