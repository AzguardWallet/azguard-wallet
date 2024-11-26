<script setup>
/** Components */
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"
import SendTypesCard from "../modules/send/SendTypesCard.vue"
import AmountCard from "../modules/send/AmountCard.vue"
import FeeJuiceCard from "../modules/send/FeeJuiceCard.vue"
import AccountCard from "../modules/send/AccountCard.vue"
import SelectTokenCard from "../modules/send/SelectTokenCard.vue"

/** Utils */
import { capitalize } from "@/utils/string"

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

						<!-- <Flex align="center" gap="6" :class="$style.selector">
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
						</Flex> -->
					</Flex>

					<Flex wide direction="column" gap="20">
						<Flex direction="column" gap="8">
							<SendTypesCard
								v-model:sendType="selectedSendType"
								v-model:receiverType="selectedReceiverType"
							/>

							<SelectTokenCard />
							<!-- <AccountCard :selectedSendType /> -->

							<AmountCard :selectedSendType />
						</Flex>

						<Input
							:label="`${capitalize(
								selectedReceiverType
							)} destination`"
							placeholder="0xABCD"
							wide
						/>
					</Flex>
				</Flex>

				<Flex direction="column" gap="12" :class="$style.bottom">
					<Button
						wide
						type="primary"
						size="medium"
						rightIcon="arrow-right-circle"
						rightIconColor="inverse"
					>
						<Text color="inverse">Send</Text>
					</Button>

					<FeeJuiceCard />
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

.bottom {
	padding: 20px;
}
</style>
