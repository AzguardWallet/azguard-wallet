<script setup>
/** Components */
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"

/** Store */
import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()

const emit = defineEmits(["onClose"])

const selectedSendType = ref("private")
const selectedReceiverType = ref("private")

const handleSwitchSendType = () => {
	selectedSendType.value =
		selectedSendType.value === "private" ? "public" : "private"
}

const handleSwitchReceiverType = () => {
	selectedReceiverType.value =
		selectedReceiverType.value === "private" ? "public" : "private"
}
</script>

<template>
	<Popup @onClose="emit('onClose')">
		<PopupCard large>
			<Flex
				wide
				direction="column"
				justify="between"
				:class="$style.wrapper"
			>
				<Flex align="center" direction="column" gap="32">
					<Flex direction="column" align="center" gap="20">
						<Flex align="center" gap="6">
							<Icon
								name="arrow-top-right-circle"
								size="16"
								color="primary"
							/>
							<Text size="16" weight="600" color="primary"
								>Send</Text
							>
						</Flex>

						<Flex align="center" gap="6" :class="$style.selector">
							<Flex
								@click="selectedSendType = 'private'"
								align="center"
								gap="6"
								:class="[
									$style.selector_item,
									selectedSendType === 'private' &&
										$style.selected,
								]"
							>
								<Icon
									v-if="selectedSendType === 'private'"
									name="key-square"
									size="16"
									color="blue"
								/>
								<Text size="13" weight="600" color="primary">
									Private
								</Text>
							</Flex>
							<Flex
								@click="selectedSendType = 'public'"
								align="center"
								gap="6"
								:class="[
									$style.selector_item,
									selectedSendType === 'public' &&
										$style.selected,
								]"
							>
								<Icon
									v-if="selectedSendType === 'public'"
									name="face"
									size="16"
									color="blue"
								/>
								<Text size="13" weight="600" color="primary">
									Public
								</Text>
							</Flex>
						</Flex>
					</Flex>

					<Flex direction="column" align="center" gap="10">
						<Text size="13" weight="600" color="secondary"
							>Amount</Text
						>
						<Text size="32" weight="600" color="primary">$900</Text>
						<Flex align="center" gap="4">
							<Icon name="zap" size="12" color="blue" />
							<Text size="12" weight="600" color="secondary">
								529 AZT
							</Text>
						</Flex>
					</Flex>
				</Flex>

				<Flex wide align="center" direction="column" gap="20">
					<Flex align="center" gap="6" :class="$style.balance_badge">
						<Icon name="vault" size="16" color="tertiary" />

						<Text size="13" weight="600" color="secondary">
							Balance: <Text color="primary">$5,629</Text>.14
						</Text>
					</Flex>

					<Flex
						wide
						direction="column"
						gap="32"
						:class="$style.bottom"
					>
						<Flex align="center" gap="6">
							<Text
								size="13"
								weight="600"
								height="120"
								color="secondary"
							>
								Using wallet
							</Text>
							<Flex align="center" gap="4">
								<Icon name="vault" size="16" color="blue" />
								<Text
									size="13"
									weight="600"
									height="120"
									color="primary"
									:class="$style.wallet_name"
								>
									{{ appStore.account.name }}
								</Text>
							</Flex>
							<Text
								size="13"
								weight="600"
								height="120"
								color="secondary"
							>
								with
							</Text>
							<Flex
								@click="handleSwitchSendType"
								align="center"
								gap="4"
							>
								<Icon
									:name="
										selectedSendType === 'private'
											? 'key-square'
											: 'face'
									"
									size="16"
									color="blue"
								/>
								<Text
									size="13"
									weight="600"
									height="120"
									color="primary"
								>
									{{ selectedSendType }}
								</Text>
							</Flex>
							<Text
								size="13"
								weight="600"
								height="120"
								color="secondary"
							>
								balance
							</Text>
						</Flex>

						<Flex direction="column" gap="8">
							<Text size="13" weight="600" color="primary"
								>Destination</Text
							>

							<Flex
								align="center"
								justify="between"
								:class="$style.input_field"
							>
								<Text size="13" weight="600" color="tertiary"
									>0xABCD</Text
								>

								<Flex
									@click="handleSwitchReceiverType"
									align="center"
									gap="4"
								>
									<Icon
										:name="
											selectedReceiverType === 'private'
												? 'key-square'
												: 'face'
										"
										size="16"
										color="blue"
									/>
									<Text
										size="13"
										weight="600"
										color="primary"
										style="text-transform: capitalize"
									>
										{{ selectedReceiverType }}
									</Text>
								</Flex>
							</Flex>
						</Flex>

						<Button
							wide
							type="primary"
							size="medium"
							rightIcon="arrow-right-circle"
						>
							<Text color="white">Continue to review</Text>
						</Button>
					</Flex>
				</Flex>
			</Flex>
		</PopupCard>
	</Popup>
</template>

<style module>
.wrapper {
	flex: 1;
}

.selector {
	border-radius: 10px;
	background: var(--gray-10);

	padding: 2px;
}

.selector_item {
	height: 24px;

	border-radius: 8px;
	cursor: pointer;

	padding: 0 8px 0 6px;

	transition: all 0.2s var(--bezier);

	&.selected {
		background: #fff;
	}
}

.balance_badge {
	height: 28px;

	border-radius: 8px;
	border: 2px solid var(--gray-5);

	padding: 0 6px;
}

.bottom {
	border-top: 1px solid var(--gray-10);
	background: linear-gradient(rgba(0, 0, 0, 3%), rgba(0, 0, 0, 0%));

	padding: 20px;
}

.wallet_name {
	max-width: 56px;

	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.input_field {
	height: 36px;

	background: #fff;
	border-radius: 10px;
	border: 2px solid var(--gray-5);
	cursor: pointer;

	padding: 0 12px;
}
</style>
