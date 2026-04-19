<route lang="json">
{
	"meta": {
		"title": "Settings",
		"isAuthRequired": true,
		"showBottomNav": true
	}
}
</route>

<script setup>
/** Store */
import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()

/** Hero visibility → compact sticky title fade */
const heroRef = useTemplateRef("heroRef")
const heroVisible = ref(true)
let heroObserver = null

onMounted(() => {
	if (heroRef.value) {
		heroObserver = new IntersectionObserver(
			([entry]) => {
				heroVisible.value = entry.isIntersecting
			},
			{ threshold: 0 },
		)
		heroObserver.observe(heroRef.value)
	}
})

onBeforeUnmount(() => {
	heroObserver?.disconnect()
})
</script>

<template>
	<Flex v-if="appStore.isLogined" direction="column" :class="$style.wrapper">
		<div :class="[$style.page_title_bar, !heroVisible && $style.page_title_bar_visible]">
			<span :class="$style.page_title_label">SETTINGS</span>
		</div>

		<Flex ref="heroRef" direction="column" align="center" gap="16" :class="$style.hero">
			<h1 :class="$style.hero_title">SETTINGS</h1>
			<div :class="$style.hero_bar" />
		</Flex>

		<Flex direction="column" gap="32" :class="$style.content">
			<ItemsContainer title="Identity">
				<SettingItem
					to="/popup/settings/profile"
					:title="appStore.profile.name"
					description="Profile name, password, backup"
					materialIcon="person"
					chevron
				/>
				<SettingItem
					to="/popup/settings/accounts"
					title="Accounts"
					description="Switch, create, manage"
					materialIcon="account_balance_wallet"
					chevron
				/>
			</ItemsContainer>

			<ItemsContainer title="Connections">
				<SettingItem
					to="/popup/settings/contacts"
					title="Contacts"
					description="Saved addresses"
					materialIcon="group"
					chevron
				/>
				<SettingItem
					to="/popup/settings/networks"
					title="Networks"
					description="Aztec networks and RPCs"
					materialIcon="hub"
					chevron
				/>
				<SettingItem
					to="/popup/settings/tokens"
					title="Tokens"
					description="Tracked tokens and balances"
					materialIcon="toll"
					chevron
				/>
				<SettingItem
					to="/popup/settings/fpcs"
					title="Fee Payments"
					description="FPCs and fee methods"
					materialIcon="local_gas_station"
					chevron
				/>
			</ItemsContainer>

			<ItemsContainer title="Security & Privacy">
				<SettingItem
					to="/popup/settings/security"
					title="Security & Backup"
					description="Auto-lock, seed phrase, secret key"
					materialIcon="lock"
					chevron
				/>
				<SettingItem
					to="/popup/settings/privacy"
					title="Privacy"
					description="Stealth mode and external defaults"
					materialIcon="shield"
					chevron
				/>
				<SettingItem
					to="/popup/settings/connected-apps"
					title="Connected Apps"
					description="Apps with granted permissions"
					materialIcon="extension"
					chevron
				/>
			</ItemsContainer>

			<ItemsContainer title="App">
				<SettingItem
					to="/popup/settings/appearance"
					title="Appearance"
					description="Theme and display"
					materialIcon="palette"
					chevron
				/>
				<SettingItem
					to="/popup/settings/advanced"
					title="Advanced"
					description="Developer, account state, explorer"
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
	scrollbar-gutter: stable;
	background: var(--app-bg);

	padding-bottom: var(--nav-clearance);
}

.page_title_bar {
	position: sticky;
	top: 0;
	z-index: 5;

	display: flex;
	align-items: center;

	padding: 12px 24px;

	background: var(--app-bg);
	border-bottom: 1px solid var(--nulo-border);

	opacity: 0;
	pointer-events: none;

	transition: opacity 0.18s cubic-bezier(0.4, 0, 1, 1);
}

.page_title_bar_visible {
	opacity: 1;
	pointer-events: auto;
}

.page_title_label {
	font-family: var(--font-headline);
	font-size: 13px;
	font-weight: 700;
	letter-spacing: 0.12em;
	text-transform: uppercase;
	color: var(--txt-primary);
}

.hero {
	padding: 0 24px 32px 24px;
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
