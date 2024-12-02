<script setup>
const route = useRoute()

const navigationLinks = [
	{
		path: "/popup/activity",
		icon: "zap-circle",
	},
	{
		path: "/popup/general",
		icon: "wallet",
	},
	{
		path: "/popup/settings",
		icon: "settings",
	},
]
</script>

<template>
	<Flex align="center" justify="center" gap="32" :class="$style.wrapper">
		<RouterLink v-for="link in navigationLinks" :to="link.path">
			<Flex :class="$style.button">
				<Icon
					:name="link.icon"
					size="24"
					:color="route.path.includes(link.path) ? 'primary' : 'tertiary'"
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
	border-radius: 12px;

	padding: 8px 16px;

	&:hover {
		background: linear-gradient(var(--gray-3), var(--gray-5));
	}
}
</style>
