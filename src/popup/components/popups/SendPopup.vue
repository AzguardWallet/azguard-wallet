<script setup>
/** Components */
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"
import AmountCard from "../modules/send/AmountCard.vue"

/** Utils */
import { comma } from "@/utils/amount.js"

/** Store */
import { useAppStore } from "@/stores/app.store"
import { usePopupStore } from "@/stores/popup.store"
const appStore = useAppStore()
const popupStore = usePopupStore()

const displaceIdx = computed(() => {
	return (
		popupStore.popups.length -
		popupStore.popups.findIndex((p) => p === "send")
	)
})

const emit = defineEmits(["onClose"])

const selectedSendType = ref("private")
const selectedReceiverType = ref("private")

const balance = reactive({
	private: 762,
	public: 5926,
})

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
		<PopupCard large :displaceIdx="displaceIdx">
			<Flex
				wide
				direction="column"
				justify="between"
				:class="$style.wrapper"
			>
				<Flex
					align="center"
					direction="column"
					gap="24"
					:class="$style.top"
				>
					<Flex direction="column" align="center" gap="20">
						<Flex align="center" gap="6">
							<Icon
								name="arrow-top-right-circle"
								size="16"
								color="primary"
							/>
							<Text size="16" weight="600" color="primary">
								Send
							</Text>
						</Flex>

						<Flex align="center" gap="6" :class="$style.selector">
							<Flex
								@click="selectedSendType = 'private'"
								align="center"
								gap="6"
								:class="[
									$style.selector_item,
									$style.pad,
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
									$style.pad,
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

					<Flex wide direction="column" gap="8">
						<AmountCard />

						<Flex
							align="center"
							justify="between"
							:class="$style.card_wrapper"
						>
							<Flex align="center" gap="8">
								<Icon name="vault" size="16" color="blue" />
								<Text size="13" weight="600" color="primary">
									{{ appStore.account.name }}
								</Text>
								<Text size="13" weight="600" color="body">
									{{ appStore.account.address.slice(0, 6) }}
									•••
									{{ appStore.account.address.slice(-4) }}
								</Text>
							</Flex>

							<Tooltip position="end">
								<Flex align="center" gap="6">
									<Icon
										:name="
											selectedSendType === 'private'
												? 'key-square'
												: 'face'
										"
										size="14"
										color="secondary"
									/>
									<Text
										size="13"
										weight="600"
										color="primary"
									>
										{{ comma(balance[selectedSendType]) }}
										AZT
									</Text>
								</Flex>

								<template #content>
									Your {{ selectedSendType }} balance
								</template>
							</Tooltip>
						</Flex>

						<Flex
							align="center"
							justify="between"
							:class="$style.card_wrapper"
						>
							<Flex align="center" gap="8">
								<Icon
									name="discount"
									size="16"
									color="orange"
								/>
								<Text size="13" weight="600" color="primary">
									Fee Juice
								</Text>
								<Icon
									name="chevron"
									size="12"
									color="secondary"
								/>
							</Flex>

							<Text size="13" weight="600" color="primary">
								1.52 FJC
							</Text>
						</Flex>
					</Flex>

					<Input label="Destination" placeholder="0xABCD" wide>
						<template #suffix>
							<Flex
								@click="handleSwitchReceiverType"
								align="center"
								gap="6"
								:class="[$style.selector_item]"
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
						</template>
					</Input>
				</Flex>

				<Flex :class="$style.bottom">
					<Button
						wide
						type="primary"
						size="medium"
						rightIcon="arrow-right-circle"
					>
						<Text color="white">Send</Text>
					</Button>
				</Flex>
			</Flex>
		</PopupCard>
	</Popup>
</template>

<style module>
.wrapper {
	flex: 1;
}

.top {
	padding: 0 20px;
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

	transition: all 0.2s var(--bezier);

	&.pad {
		padding: 0 8px 0 6px;
	}

	&.selected {
		background: var(--card-bg);
	}
}

.card_wrapper {
	width: 100%;

	background: var(--card-bg);
	box-shadow: inset 0 0 0 1px var(--gray-10), 0 1px 2px var(--gray-5);
	border-radius: 12px;

	padding: 12px;
}

.bottom {
	padding: 20px;
}
</style>
