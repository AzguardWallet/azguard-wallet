<script setup>
const route = useRoute()

const navigationLinks = [
	{
		name: "activity",
		path: "/popup/activity",
		icon: "zap-circle",
	},
	{
		name: "general",
		path: "/popup/general",
		icon: "wallet",
	},
	{
		name: "settings",
		path: "/popup/settings",
		icon: "settings",
	},
]
</script>

<template>
	<Flex align="center" justify="center" gap="32" :class="$style.wrapper">
		<RouterLink v-for="link in navigationLinks" :to="link.path">
			<Flex :class="$style.button">
				<Icon :name="link.icon" size="24" :color="route.path === link.path ? 'primary' : 'tertiary'" />

				<Icon
					v-if="route.name === 'popup-tokens-id' && link.name === 'general'"
					name="banknote"
					size="14"
					color="primary"
					:class="$style.banknote_icon"
				/>
			</Flex>
		</RouterLink>
	</Flex>
</template>

<style module>
.wrapper {
	position: absolute;
	bottom: 0;
	left: 0;
	right: 0;
	z-index: 1;

	background: var(--card-bg);
	border-top: 2px solid var(--gray-5);

	padding: 8px 0;
}

.button {
	position: relative;

	border-radius: 12px;

	padding: 8px 16px;

	&:hover {
		background: linear-gradient(var(--gray-3), var(--gray-5));
	}
}

.banknote_icon {
	position: absolute;
	top: 2px;
	right: 8px;

	background: var(--card-bg);
	box-sizing: content-box;
	border-radius: 6px;

	padding: 1px;
}
</style>
