<route lang="json">
{
	"meta": {
		"isAuthRequired": true
	}
}
</route>

<script setup>
/** Components */

/** Store */
import { useAppStore } from "@/stores/app.store.ts"
import { useCacheStore } from "@/stores/cache.store"
const appStore = useAppStore()
const cacheStore = useCacheStore()

const handleOpenLogs = async () => {
	if (appStore.loggerWindowId) {
		try {
			const win = await chrome.windows.get(appStore.loggerWindowId)
			chrome.windows.update(win.id, { focused: true })
			cacheStore.failureLog = null
			return
		} catch (error) {
			appStore.loggerWindowId = null
		}
	}

	const url = new URL(chrome.runtime.getURL("src/popup/index.html#/windows/logger"))
	if (cacheStore.failureLog?.id) {
		url.searchParams.set("logId", cacheStore.failureLog.id)
	}

	const window = await chrome.windows.create({ type: "popup", url: url.toString(), height: 700, width: 1_200 })
	cacheStore.failureLog = null
	appStore.loggerWindowId = window.id
}
</script>

<template>
	<Flex direction="column" :class="$style.wrapper">
		<SubPageHeader title="General" :backTo="'/popup/settings'" />

		<Flex direction="column" gap="20" :class="$style.content">
			<ItemsContainer title="Profile">
				<SettingItem to="/popup/settings/general/accounts" title="Accounts" icon="vault" iconBgColor="green" />
				<SettingItem to="/popup/settings/general/tokens" title="Tokens" icon="banknote" iconBgColor="blue" />
				<SettingItem to="/popup/settings/general/fpcs" title="FPCs" icon="fpcs" iconBgColor="blue" />
				<SettingItem to="/popup/settings/general/contacts" title="Contacts" icon="contacts" iconBgColor="blue" />
				<SettingItem to="/popup/settings/general/networks" title="Networks" icon="globe" iconBgColor="blue" />
				<SettingItem to="/popup/settings/general/sessions" title="Sessions" icon="plug-circle" iconBgColor="sand" />
			</ItemsContainer>

			<ItemsContainer title="Activity">
				<SettingItem
					@click="handleOpenLogs"
					title="Logs"
					icon="logs"
					iconBgColor="gray"
					chevron
				>
					<template v-if="cacheStore.failureLog?.color" #dot>
						<div :class="$style.dot_indicator" :style="{ background: cacheStore.failureLog.color }" />
					</template>
				</SettingItem>
			</ItemsContainer>

			<ItemsContainer title="Interface">
				<SettingItem to="/popup/settings/general/appearance" title="Appearance" icon="sun" iconBgColor="purple" />
			</ItemsContainer>
		</Flex>

	</Flex>
</template>

<style module>
.wrapper {
	flex: 1;
	overflow: auto;
	background: var(--app-bg);
	scrollbar-gutter: stable;
}

.content {
	padding: 16px 24px var(--nav-clearance) 24px;
}

.item {
	border-radius: 0;
	border: 1px solid var(--nulo-border);
	cursor: pointer;

	padding: 12px;

	transition: all 0.2s var(--bezier);

	&:hover {
		background: var(--nulo-surface-low);

		& .item_icon {
			transform: rotate(-90deg) translateY(3px);
		}
	}

	&:active {
		background: var(--nulo-surface-high);
	}
}

.item_icon {
	transform: rotate(-90deg);

	transition: transform 0.2s var(--bezier);
}

.dot_indicator {
	position: absolute;
	top: -2px;
	right: -2px;
	width: 9px;
	height: 9px;
	border-radius: 50%;
}
</style>
