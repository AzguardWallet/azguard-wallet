<route lang="json">
{
	"meta": {
		"title": "Settings",
		"isAuthRequired": true
	}
}
</route>

<script setup>
/** Components */

/** Store */
import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()
</script>

<template>
	<Flex v-if="appStore.isLogined" direction="column" :class="$style.wrapper">
		<Flex direction="column" align="center" gap="16" :class="$style.hero">
			<h1 :class="$style.hero_title">SETTINGS</h1>
			<div :class="$style.hero_bar" />
		</Flex>

		<Flex direction="column" gap="32" :class="$style.content">
			<ItemsContainer title="Wallet">
				<SettingItem
					to="/popup/settings/profile"
					:title="appStore.profile.name"
					materialIcon="person"
					chevron
				/>
				<SettingItem
					to="/popup/settings/account"
					:title="appStore.account.name"
					materialIcon="account_balance_wallet"
					chevron
				/>
			</ItemsContainer>

			<ItemsContainer title="System">
				<SettingItem
					to="/popup/settings/general"
					title="General"
					materialIcon="tune"
					chevron
				/>
				<SettingItem
					to="/popup/settings/security"
					title="Security"
					materialIcon="lock"
					chevron
				/>
				<SettingItem
					to="/popup/settings/advanced"
					title="Advanced"
					materialIcon="bolt"
					chevron
				/>
			</ItemsContainer>

			<RouterLink to="/popup/settings/about" :class="$style.footer_link">
				About Nulo
			</RouterLink>
		</Flex>

	</Flex>
</template>

<style module>
.wrapper {
	flex: 1;

	overflow: auto;
	background: var(--app-bg);

	padding-bottom: var(--nav-clearance);
}

.hero {
	padding: 40px 24px 32px 24px;
}

.hero_title {
	font-family: var(--font-headline);
	font-size: 48px;
	font-weight: 700;
	letter-spacing: -0.04em;
	text-transform: uppercase;
	color: var(--txt-primary);
	line-height: 1;
	margin: 0;
}

.hero_bar {
	width: 24px;
	height: 1px;
	background: var(--nulo-accent);
}

.content {
	padding: 0 24px;
}

.footer_link {
	align-self: center;

	font-family: var(--font-headline);
	font-size: 10px;
	font-weight: 700;
	letter-spacing: 0.2em;
	text-transform: uppercase;
	color: var(--nulo-secondary);
	text-decoration: underline;
	text-decoration-color: var(--nulo-outline);
	text-underline-offset: 6px;

	margin-top: 16px;

	transition: color 0.2s var(--bezier);

	&:hover {
		color: var(--nulo-accent);
	}
}
</style>
