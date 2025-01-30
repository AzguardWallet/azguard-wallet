<route lang="json">
{
	"meta": {
		"title": "Azguard Wallet",
		"isAuthRequired": true
	}
}
</route>

<script setup>
/** Components */
import Navigation from "../../components/Navigation.vue"
import Breadcrumbs from "@/components/ui/Settings/Breadcrumbs.vue"
import ItemsContainer from "@/components/ui/Settings/ItemsContainer.vue"
import SettingItem from "@/components/ui/Settings/SettingItem.vue"

/** Composables */
import { useToast } from "@/composables/toast"
const { openToast } = useToast()

const version = __VERSION__

const handleCopyVersion = () => {
	window.navigator.clipboard.writeText(version)
	openToast({ label: "Version is copied", icon: "copy" })
}

const handleOpen = target => {
	chrome.windows.create({
		type: "popup",
		url: `https://azguardwallet.io/${target}`,
		width: 360,
		height: 600,
	})
}
</script>

<template>
	<Flex direction="column" :class="$style.wrapper">
		<Flex direction="column" gap="24" align="center">
			<Breadcrumbs />

			<Flex wide align="start" direction="column" gap="8">
				<Text size="13" weight="600" color="primary"> Azguard Wallet </Text>
				<Text @click="handleCopyVersion" size="12" weight="500" color="support" class="copyable">
					Version {{ version }} - Alpha Testing
				</Text>
			</Flex>

			<ItemsContainer wide>
				<SettingItem
					to="https://azguardwallet.io"
					title="Azguard Website"
					icon="globe"
					iconBgColor="blue"
					external
				/>
			</ItemsContainer>

			<ItemsContainer title="Contact us" wide>
				<SettingItem
					to="https://azguardwallet.io/forms/feedback"
					title="Feedback"
					description="Suggest an idea"
					icon="face"
					external
				/>
				<SettingItem
					to="https://azguardwallet.io/forms/report-issue"
					title="Report Issue"
					description="If you're facing a bug"
					icon="bug"
					external
				/>
				<SettingItem
					to="https://azguardwallet.io/forms/report-scam"
					title="Report Scam"
					description="Tell us about the scammers"
					icon="warning"
					external
				/>
			</ItemsContainer>

			<ItemsContainer wide>
				<SettingItem @click="handleOpen('terms')" title="Terms of use" />
				<SettingItem @click="handleOpen('privacy')" title="Privacy policy" />
			</ItemsContainer>
		</Flex>

		<Navigation />
	</Flex>
</template>

<style module>
.wrapper {
	flex: 1;

	overflow: auto;

	background: var(--card-bg);
	border-top: 2px solid var(--gray-8);
	box-shadow: inset 0 10px 8px -2px var(--gray-3);

	border-top-left-radius: 24px;
	border-top-right-radius: 24px;

	padding: 20px 24px 80px 24px;
}
</style>
