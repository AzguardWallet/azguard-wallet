<script setup>
/** Components */
import Navigation from "../../components/Navigation.vue"

const version = __VERSION__

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
			<Flex wide align="center" gap="8">
				<RouterLink to="/popup/settings">
					<Text
						size="13"
						weight="600"
						color="tertiary"
						style="line-height: 16px"
					>
						Settings
					</Text>
				</RouterLink>
				<Text color="support">•</Text>
				<Text
					size="13"
					weight="600"
					color="tertiary"
					style="line-height: 16px"
				>
					About
				</Text>
			</Flex>

			<Flex wide align="start" direction="column" gap="8">
				<Text size="13" weight="600" color="primary">
					Azguard Wallet
				</Text>
				<Text size="12" weight="500" color="support">
					Version {{ version }} - Alpha Testing
				</Text>
			</Flex>

			<Flex wide direction="column" gap="16">
				<a href="https://azguardwallet.io" target="_blank">
					<Flex align="center" justify="between" :class="$style.item">
						<Flex align="center" gap="10">
							<Icon name="globe" size="16" color="secondary" />

							<Text size="14" weight="600" color="primary">
								Azguard Website
							</Text>
						</Flex>

						<Icon
							name="arrow-narrow-up-right"
							size="16"
							color="tertiary"
							:class="$style.item_icon"
						/>
					</Flex>
				</a>
			</Flex>

			<Flex wide direction="column" gap="10">
				<Text size="12" weight="600" color="secondary">Contact Us</Text>
				<a
					href="https://azguardwallet.io/forms/feedback"
					target="_blank"
				>
					<Flex justify="between" :class="$style.item">
						<Flex gap="10">
							<Icon name="face" size="16" color="secondary" />

							<Flex direction="column" gap="6">
								<Text size="14" weight="600" color="primary">
									Feedback
								</Text>
								<Text size="13" weight="500" color="tertiary">
									Suggest an idea
								</Text>
							</Flex>
						</Flex>

						<Icon
							name="arrow-narrow-up-right"
							size="16"
							color="tertiary"
							:class="$style.item_icon"
						/>
					</Flex>
				</a>
				<a
					href="https://azguardwallet.io/forms/report-issue"
					target="_blank"
				>
					<Flex justify="between" :class="$style.item">
						<Flex gap="10">
							<Icon name="bug" size="16" color="secondary" />

							<Flex direction="column" gap="6">
								<Text size="14" weight="600" color="primary">
									Report Issue
								</Text>
								<Text size="13" weight="500" color="tertiary">
									If you're facing a bug
								</Text>
							</Flex>
						</Flex>

						<Icon
							name="arrow-narrow-up-right"
							size="16"
							color="tertiary"
							:class="$style.item_icon"
						/>
					</Flex>
				</a>
				<a
					href="https://azguardwallet.io/forms/report-scam"
					target="_blank"
				>
					<Flex justify="between" :class="$style.item">
						<Flex gap="10">
							<Icon name="warning" size="16" color="secondary" />

							<Flex direction="column" gap="6">
								<Text size="14" weight="600" color="primary">
									Report Scam
								</Text>
								<Text size="13" weight="500" color="tertiary">
									Tell us about the scammers
								</Text>
							</Flex>
						</Flex>

						<Icon
							name="arrow-narrow-up-right"
							size="16"
							color="tertiary"
							:class="$style.item_icon"
						/>
					</Flex>
				</a>
			</Flex>

			<Flex wide align="center" gap="10">
				<Text
					@click="handleOpen('terms')"
					size="12"
					weight="600"
					color="blue"
				>
					Terms of Use
				</Text>
				<Text size="12" color="support">•</Text>
				<Text
					@click="handleOpen('privacy')"
					size="12"
					weight="600"
					color="blue"
				>
					Privacy Policy
				</Text>
			</Flex>
		</Flex>

		<Navigation />
	</Flex>
</template>

<style module>
.wrapper {
	flex: 1;

	overflow: auto;

	background: var(--card-bg);
	box-shadow: 0 0 0 1px var(--gray-5);

	border-top-left-radius: 24px;
	border-top-right-radius: 24px;

	padding: 20px 24px 80px 24px;
}

.item {
	border-radius: 12px;
	box-shadow: inset 0 0 0 1px var(--gray-10);
	cursor: pointer;

	padding: 12px;

	transition: all 0.2s var(--bezier);

	&:hover {
		background: var(--gray-3);
	}

	&:active {
		background: var(--gray-5);
	}
}
</style>
