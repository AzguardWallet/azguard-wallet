<template>
	<Flex wide align="center" gap="12" :class="$style.wrapper">
		<Flex align="center" justify="center" :class="$style.activity_icon">
			<Spinner size="16" color="--txt-primary" />

			<Icon name="zap-circle" size="14" color="blue" :class="$style.zap_icon" />
		</Flex>

		<Flex direction="column" gap="6">
			<Text size="13" weight="600" color="primary"> Transaction in progress </Text>
			<Text size="12" weight="500" color="tertiary"> Awaiting confirmation </Text>
		</Flex>
	</Flex>
</template>

<style module>
.wrapper {
	cursor: pointer;
	border-radius: 8px;

	padding: 8px;

	transition: all 0.2s var(--bezier);

	&:hover {
		background: var(--gray-3);
	}

	&:active {
		background: var(--gray-5);
	}
}

.activity_icon {
	position: relative;

	width: 32px;
	height: 32px;

	border-radius: 50%;
	background: linear-gradient(var(--gray-8), var(--gray-3));
}

.zap_icon {
	position: absolute;
	top: -8px;
	right: -8px;

	box-sizing: content-box;
	border: 3px solid var(--card-bg);
	border-radius: 50%;
}
</style>
