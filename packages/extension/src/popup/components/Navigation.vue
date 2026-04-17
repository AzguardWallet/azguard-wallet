<script setup>
const route = useRoute()

const navigationLinks = [
	{
		name: "general",
		path: "/popup/general",
		materialIcon: "account_balance_wallet",
		label: "ASSETS",
	},
	{
		name: "activity",
		path: "/popup/activity",
		materialIcon: "history",
		label: "HISTORY",
	},
	{
		name: "settings",
		path: "/popup/settings",
		materialIcon: "settings",
		label: "SETTINGS",
	},
]
</script>

<template>
	<nav :class="$style.wrapper">
		<RouterLink
			v-for="link in navigationLinks"
			:to="link.path"
			:data-testid="`nav-${link.name}`"
			:class="[$style.tab, route.path.includes(link.path) && $style.active]"
		>
			<MaterialIcon :name="link.materialIcon" :size="22" :color="route.path.includes(link.path) ? 'primary' : 'tertiary'" />
			<span :class="$style.label">{{ link.label }}</span>
		</RouterLink>
	</nav>
</template>

<style module>
.wrapper {
	position: absolute;
	bottom: 0;
	left: 0;
	right: 0;
	z-index: 1;

	display: flex;
	justify-content: space-around;
	align-items: center;

	background: var(--app-bg);
	border-top: 1px solid rgba(74, 70, 63, 0.2);

	padding: 0 16px;
	height: 64px;
}

.tab {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 4px;

	padding-top: 8px;
	border-top: 2px solid transparent;
	text-decoration: none;
	color: var(--nulo-secondary);
	-webkit-tap-highlight-color: transparent;

	transition: all 0.3s ease;

	&:hover {
		color: var(--txt-primary);
	}
}

.active {
	border-top-color: var(--nulo-accent);
}

.label {
	font-family: var(--font-headline);
	font-size: 10px;
	font-weight: 500;
	letter-spacing: 0.05em;
	text-transform: uppercase;
	color: inherit;
}

.active .label {
	color: var(--txt-primary);
}
</style>
