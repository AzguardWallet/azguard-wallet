<route lang="json">
{
	"meta": {
		"isAuthRequired": true
	}
}
</route>

<script setup>
/** Components */

/** Composables */
import { useToast } from "@/composables/toast"
const { openToast } = useToast()

const version = __VERSION__
const aztecVersion = __AZTEC_VERSION__

const handleCopy = (target) => {
	window.navigator.clipboard.writeText(target)
	openToast({ label: "Version is copied", icon: "copy" })
}

const handleOpen = (target) => {
	chrome.windows.create({
		type: "popup",
		url: `https://nulo.sh/${target}`,
		width: 360,
		height: 600,
	})
}
</script>

<template>
	<Flex direction="column" :class="$style.wrapper">
		<SubPageHeader title="About Nulo" :backTo="'/popup/settings'" />
		<Flex direction="column" gap="24" align="center" :class="$style.content">
			<Flex wide align="start" direction="column" gap="8">
				<Text size="13" weight="600" color="primary"> Nulo </Text>
				<Flex align="start" direction="column" gap="4" wide>
					<Text @click="handleCopy(version)" size="12" weight="500" color="support" class="copyable">
						Wallet version - {{ version }} - Alpha Testing
					</Text>
					<Text @click="handleCopy(aztecVersion)" size="12" weight="500" color="support" class="copyable">
						Aztec version - {{ aztecVersion }}
					</Text>
				</Flex>
			</Flex>

			<ItemsContainer wide>
				<SettingItem
					to="https://nulo.sh"
					title="Nulo Website"
					icon="globe"
					iconBgColor="blue"
					external
				/>
			</ItemsContainer>

			<ItemsContainer title="Contact us" wide>
				<SettingItem
					to="https://nulo.sh/forms/feedback"
					size="large"
					title="Feedback"
					description="Suggest an idea"
					icon="face"
					external
				/>
				<SettingItem
					to="https://nulo.sh/forms/report-issue"
					size="large"
					title="Report Issue"
					description="If you're facing a bug"
					icon="bug"
					external
				/>
				<SettingItem
					to="https://nulo.sh/forms/report-scam"
					size="large"
					title="Report Scam"
					description="Tell us about the scammers"
					icon="warning"
					external
				/>
			</ItemsContainer>

			<ItemsContainer wide>
				<SettingItem @click="handleOpen('terms')" size="small" title="Terms of use" chevron />
				<SettingItem @click="handleOpen('privacy')" size="small" title="Privacy policy" chevron />
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
</style>
