<script setup>
/** Components */
import RegisterPopup from "../components/popups/RegisterPopup/RegisterPopup.vue"

/** Store */
import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()
</script>

<template>
	<Flex
		wide
		direction="column"
		align="center"
		justify="between"
		:class="$style.wrapper"
	>
		<Flex direction="column" align="center" gap="16">
			<Text size="32" weight="500" align="center" :class="$style.title">
				Privacy of finances is paramount
			</Text>
			<Text
				size="14"
				weight="500"
				color="body"
				height="140"
				align="center"
				:class="$style.description"
			>
				Get power of privacy on Ethereum with Aztec Blockchain
			</Text>
		</Flex>

		<Flex
			direction="column"
			gap="24"
			align="center"
			:class="[$style.bottom]"
		>
			<Flex wide direction="column" gap="12">
				<Button
					@click="appStore.showRegisterPopup = true"
					size="dynamic"
					type="primary"
					wide
				>
					<Flex direction="column" align="center" gap="8">
						<Text size="14" weight="600" color="white">
							Create a new wallet
						</Text>
						<Text
							size="12"
							weight="600"
							style="color: var(--op-40)"
						>
							Private and Public
						</Text>
					</Flex>
				</Button>
				<Button size="medium" type="secondary" wide>
					<Flex align="center" gap="6">
						<Icon name="import" size="16" color="tertiary" />
						Import Wallet
					</Flex>
				</Button>
			</Flex>

			<Text
				size="11"
				weight="500"
				color="tertiary"
				height="140"
				align="center"
			>
				By continuing, you are confirming that you read and agree to
				<Text color="secondary">Terms of Use</Text> and
				<Text color="secondary">Privacy Policy</Text>
			</Text>
		</Flex>

		<Transition name="slide">
			<RegisterPopup v-if="appStore.showRegisterPopup" />
		</Transition>
	</Flex>
</template>

<style module>
.wrapper {
	position: relative;
	overflow: hidden;

	height: 100%;

	padding-top: 170px;
	margin: 0 auto;
}

.title {
	max-width: 300px;

	font-family: "Clash Display";

	background-image: linear-gradient(rgba(0, 0, 0, 90%), rgba(0, 0, 0, 60%));
	background-clip: text;
	background-size: 100%;
	-webkit-text-fill-color: transparent;
}

.description {
	max-width: 240px;
}

.bottom {
	max-width: 260px;

	margin-bottom: 24px;

	transition: all 0.5s var(--bezier);
}
</style>
