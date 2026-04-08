<route lang="json">
{
	"meta": {
		"title": "Vibeguard",
		"isAuthRequired": true
	}
}
</route>

<script setup>


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
				<Text size="13" weight="600" color="primary"> Vibeguard </Text>
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
					size="large"
					title="Feedback"
					description="Suggest an idea"
					icon="face"
					external
				/>
				<SettingItem
					to="https://azguardwallet.io/forms/report-issue"
					size="large"
					title="Report Issue"
					description="If you're facing a bug"
					icon="bug"
					external
				/>
				<SettingItem
					to="https://azguardwallet.io/forms/report-scam"
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
