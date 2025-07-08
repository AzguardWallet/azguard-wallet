<script setup>
/** Components */
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"

/** Store */
import { usePopupStore } from "@/stores/popup.store"
const popupStore = usePopupStore()

const emit = defineEmits(["onClose"])

const props = defineProps({
	show: Boolean,
})

const displaceIdx = computed(() => {
	return popupStore.len - popupStore.popups.select_deposit?.order
})

const depositMethods = [
    {
        title: "Human Tech",
        alias: "human_tech",
        description: "Bridge between Etherium and Aztec",
        target: "https://bridge.human.tech/",
        icon: "human_tech",
    },
    {
        title: "Faucet",
        alias: "faucet",
        description: "Azguard wallet faucet",
        target: "faucet",
        icon: "logo",
    },
]

const handleSelectDepositMethod = (deposit) => {
	emit("onClose")

    switch (deposit.alias) {
        case "faucet":
            popupStore.open(deposit.target)
            break;
        case "human_tech":
            chrome.tabs.create({ url: deposit.target });
            break;
        default:
            break;
    }    
}
</script>

<template>
	<Popup :show @onClose="emit('onClose')" :displaceIdx="popupStore.popups.select_deposit?.order">
		<PopupCard :displaceIdx>
			<PopupHeader @onClose="emit('onClose')" closable>
				<template #title>
					<Text size="14" weight="600" color="primary">Select deposit method</Text>
				</template>
			</PopupHeader>

			<Flex wide direction="column" gap="24" :class="$style.wrapper">
				<ItemsContainer>
					<SettingItem
						v-for="d in depositMethods"
						@click="handleSelectDepositMethod(d)"
						:title="d.title"
                        :description="d.description"
						:icon="d.icon"
						iconFillColor="primary"
						iconBgColor="transparent"
					/>
				</ItemsContainer>
			</Flex>
		</PopupCard>
	</Popup>
</template>

<style module>
.wrapper {
	padding: 0 20px 24px 20px;
}

.method {
	border-radius: 12px;
	cursor: pointer;
	box-shadow: inset 0 0 0 1px var(--border), 0 1px 2px var(--shadow-5);

	padding: 12px 16px 12px 12px;

	transition: all 0.2s var(--bezier);

	&:hover {
		background: var(--gray-3);
		box-shadow: inset 0 0 0 1px var(--border-hovered), 0 1px 2px var(--shadow-5);
	}

	&:active {
		background: var(--gray-5);
	}
}
</style>
