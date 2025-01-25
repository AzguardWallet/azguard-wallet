<script setup>
const props = defineProps({
	icon: {
		type: String,
		required: true,
	},
	iconColor: {
		type: String,
		required: false,
	},
	title: {
		type: String,
		required: true,
	},
	description: {
		type: String,
		required: true,
	},
})
</script>

<template>
	<Flex direction="column" align="center" gap="16">
		<Flex :class="[$style.icon, $style[iconColor]]">
			<Icon :name="icon" size="24" color="primary" />
			<div />
		</Flex>

		<Flex align="center" direction="column" gap="8">
			<Text size="14" weight="600" color="primary" align="center" :class="$style.title"> {{ title }} </Text>

			<Text size="13" weight="500" height="150" color="tertiary" align="center" style="padding: 0 24px">
				{{ description }}
			</Text>
		</Flex>
	</Flex>
</template>

<style module>
.icon {
	position: relative;

	& div {
		position: absolute;

		background: linear-gradient(var(--gray-15), var(--gray-5));
		inset: -1px;
		border-radius: 13px;

		z-index: 0;
	}

	&.red {
		& svg {
			background: var(--red);
		}
	}

	&.green {
		& svg {
			background: var(--green);
		}
	}

	& svg {
		z-index: 1;

		border-radius: 12px;
		background: var(--blue);
		box-shadow: 0 2px 4px var(--op-10);
		box-sizing: content-box;

		padding: 8px;
	}
}

.title {
	max-width: 250px;

	text-overflow: ellipsis;
	overflow: hidden;
	white-space: nowrap;
}
</style>
