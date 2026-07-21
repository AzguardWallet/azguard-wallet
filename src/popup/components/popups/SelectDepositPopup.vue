<script setup>
/** Components */
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"

/** Utils */
import { CHAIN_IDS, isTestnet } from "@/components/ui/utils"

/** Stores */
import { useAppStore } from "@/stores/app.store"
import { usePopupStore } from "@/stores/popup.store"
const appStore = useAppStore()
const popupStore = usePopupStore()

/** Composables */
const { handleExternalLink } = useExternalLink()

const emit = defineEmits(["onClose"])

const props = defineProps({
	show: Boolean,
})

const displaceIdx = computed(() => {
	return popupStore.len - popupStore.popups.select_deposit?.order
})

const depositMethods = computed(() => {
	const bridgeUrl = isTestnet(appStore.network?.chainId)
		? "https://testnet.shield.human.tech/"
		: "https://shield.human.tech/"
	const methods = [
		{
			title: "Human Tech Bridge",
			alias: "human_tech",
			description: "Bridge between Etherium and Aztec",
			target: bridgeUrl,
			icon: "human_tech",
		},
	]
	// Faucet is available on test networks only — no free minting on mainnet.
	if (appStore.network?.chainId !== CHAIN_IDS.ALPHANET) {
		methods.push({
			title: "Azguard Faucet",
			alias: "faucet",
			description: "Mint your own Aztec token",
			target: "faucet",
			icon: "logo",
		})
	}
	return methods
})

const handleSelectDepositMethod = (event, deposit) => {
	emit("onClose")

    switch (deposit.alias) {
        case "faucet":
            popupStore.open(deposit.target)
            break;
        case "human_tech":
			handleExternalLink(event, deposit.target)
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
						@click="handleSelectDepositMethod($event, d)"
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
