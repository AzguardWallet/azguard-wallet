<route lang="json">
{
	"meta": {
		"title": "General",
		"isAuthRequired": true
	}
}
</route>

<script setup>
/** Components */
import Navigation from "../../../components/Navigation.vue"
import Breadcrumbs from "@/components/ui/Settings/Breadcrumbs.vue"
import ItemsContainer from "@/components/ui/Settings/ItemsContainer.vue"
import SettingItem from "@/components/ui/Settings/SettingItem.vue"

const handleOpenLogs = () => {
	const url = new URL(chrome.runtime.getURL("src/popup/index.html#/windows/logger"))
	chrome.windows.create({ type: "popup", url: url.toString(), height: 700, width: 1_200 })
}
</script>

<template>
	<Flex direction="column" gap="20" :class="$style.wrapper">
		<Breadcrumbs />

		<ItemsContainer title="Profile">
			<SettingItem to="/popup/settings/general/accounts" title="Accounts" icon="vault" iconBgColor="green" />
			<SettingItem to="/popup/settings/general/tokens" title="Tokens" icon="banknote" iconBgColor="blue" />
			<SettingItem to="/popup/settings/general/fpcs" title="FPCs" icon="fpcs" iconBgColor="blue" />
			<SettingItem title="Contacts" icon="contacts" iconBgColor="blue" disabled />
			<SettingItem to="/popup/settings/general/networks" title="Nodes" icon="globe" iconBgColor="blue" />
			<SettingItem to="/popup/settings/general/sessions" title="Sessions" icon="plug-circle" iconBgColor="sand" />
		</ItemsContainer>

		<ItemsContainer title="Activity">
			<SettingItem title="Task tracker" icon="task-tracker" iconBgColor="var(--green)" chevron disabled />
			<SettingItem
				@click="handleOpenLogs"
				title="Logs"
				icon="logs"
				iconBgColor="var(--gray)"
				chevron
			/>
		</ItemsContainer>

		<ItemsContainer title="Interface">
			<SettingItem to="/popup/settings/general/appearance" title="Appearance" icon="sun" iconBgColor="purple" />
		</ItemsContainer>

		<Navigation />
	</Flex>
</template>

<style module>
.wrapper {
	flex: 1;

	background: var(--card-bg);
	border-top: 2px solid var(--gray-8);
	box-shadow: inset 0 10px 8px -2px var(--gray-3);

	border-top-left-radius: 24px;
	border-top-right-radius: 24px;

	padding: 20px 24px 24px 24px;
}

.item {
	border-radius: 12px;
	box-shadow: inset 0 0 0 1px var(--gray-10);
	cursor: pointer;

	padding: 12px;

	transition: all 0.2s var(--bezier);

	&:hover {
		background: var(--gray-3);

		& .item_icon {
			transform: rotate(-90deg) translateY(3px);
		}
	}

	&:active {
		background: var(--gray-5);
	}
}

.item_icon {
	transform: rotate(-90deg);

	transition: transform 0.2s var(--bezier);
}
</style>
