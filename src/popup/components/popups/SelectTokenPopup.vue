<script setup>
/** Services */
import { TokenServiceClient } from "@/wallet/services/token/client"

/** Components */
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"
import PopupHeader from "@/components/ui/Popup/PopupHeader.vue"
import ItemsContainer from "@/components/ui/Settings/ItemsContainer.vue"
import SettingItem from "@/components/ui/Settings/SettingItem.vue"

/** Store */
import { useAppStore } from "@/stores/app.store"
import { usePopupStore } from "@/stores/popup.store"
import { useCacheStore } from "@/stores/cache.store"
const appStore = useAppStore()
const popupStore = usePopupStore()
const cacheStore = useCacheStore()

const emit = defineEmits(["onSelectToken", "onClose"])
const props = defineProps({
	show: Boolean,
	displaceIdx: Number,
})

const router = useRouter()

const displaceIdx = computed(() => {
	return popupStore.len - popupStore.popups.select_token?.order
})

const tokens = ref([])

const tokenService = new TokenServiceClient()
tokenService.onTokenAdded.add(onTokenAdded)
tokenService.onTokenDeleted.add(onTokenDeleted)
function onTokenAdded(token) {
	tokens.value.push(token)
}
function onTokenDeleted(token) {
	const idx = tokens.value.findIndex(t => t.id === token.id)
	if (idx === -1) return

	tokens.value.splice(idx, 1)
}

const transferableTokens = computed(() =>
	tokens.value.filter(t => t.hasPrivateTransfers || t.hasPublicTransfers)
)

const handleSelectToken = id => {
	cacheStore.activeTokenIdx = id
	emit("onClose")
}

const handleManageTokens = () => {
	router.push("/popup/settings/general/tokens")
	popupStore.closeAll()
}

watch(
	() => props.show,
	async () => {
		if (props.show) {
			tokens.value = await tokenService.getTokens(appStore.profile.id, appStore.network.chainId)
		} else {
			tokens.value = []
			tokenService.disconnect()
		}
	},
)
</script>

<template>
	<Popup :show @onClose="emit('onClose')" :displaceIdx="popupStore.popups.select_token?.order">
		<PopupCard :displaceIdx>
			<PopupHeader @onClose="emit('onClose')" closable>
				<template #title>
					<Text size="14" weight="600" color="primary">Select token</Text>
				</template>
			</PopupHeader>

			<Flex wide direction="column" gap="24" :class="$style.wrapper">
				<ItemsContainer>
					<SettingItem
						v-for="token in transferableTokens"
						@click="handleSelectToken(token.id)"
						:title="token.symbol"
						:icon="token.id === cacheStore.activeTokenIdx ? 'check-circle' : 'circle'"
						:iconFillColor="token.id === cacheStore.activeTokenIdx ? 'blue' : 'tertiary'"
						iconBgColor="transparent"
					/>
				</ItemsContainer>

				<ItemsContainer>
					<SettingItem
						@click="handleManageTokens"
						size="small"
						title="Manage tokens"
						icon="settings"
						iconFillColor="secondary"
						iconBgColor="transparent"
						chevron
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

.token {
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
