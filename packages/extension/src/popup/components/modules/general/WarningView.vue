<script setup>
const { handleExternalLink } = useExternalLink()

const reportIssueUrl = "https://nulo.sh/forms/report-issue"
</script>

<template>
	<Flex gap="8" :class="$style.wrapper">
		<Icon name="warning" size="16" color="orange" />
		<Flex direction="column" gap="6">
			<Text size="13" weight="600" color="primary"> Nulo is in alpha testing </Text>
			<Text size="12" weight="600" color="tertiary">
				If you're facing a bug -
				<a
					:href="reportIssueUrl"
					target="_blank"
					rel="noopener noreferrer"
					@click="handleExternalLink($event, reportIssueUrl)"
				>
					report an issue
				</a>
			</Text>
		</Flex>
	</Flex>
</template>

<style module>
.wrapper {
	border-radius: 0;

	background: repeating-linear-gradient(
		-45deg,
		var(--nulo-surface-low),
		var(--nulo-surface-low) 5px,
		var(--nulo-surface-high) 5px,
		var(--nulo-surface-high) 10px
	);
	box-shadow: 0 0 0 3px var(--nulo-surface-low);

	padding: 12px;
}
</style>
