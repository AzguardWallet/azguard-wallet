<script setup>
/** Services */
import { TokenServiceClient } from "@/wallet/services/token/client"

/** Components */
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"

/** Utils */
import { managers } from "@/utils/core"

/** Composables */
import { useToast } from "@/composables/toast"
const { openToast } = useToast()

/** Store */
import { useAppStore } from "@/stores/app.store"
import { usePopupStore } from "@/stores/popup.store"
import { useCacheStore } from "@/stores/cache.store"
const appStore = useAppStore()
const popupStore = usePopupStore()
const cacheStore = useCacheStore()

const emit = defineEmits(["onClose"])
const props = defineProps({
	show: Boolean,
})

const displaceIdx = computed(() => {
	return popupStore.len - popupStore.popups.tokens?.order
})

const tokens = ref()
const tokenService = new TokenServiceClient()
tokenService.onTokenDeleted.add(onTokenDeleted)
function onTokenDeleted(token) {
	const idx = tokens.value.findIndex(t => t.id === token.id)
	if (idx === -1) return

	tokens.value.splice(idx, 1)
}

const handleEditToken = target => {
	cacheStore.tokenToEditIdx = target.id

	popupStore.open("edit_token")
}

const handleDeleteToken = target => {
	cacheStore.confirm.description =
		"Removing a token only affects the display in the UI and it does not affect the token balance"
	cacheStore.confirm.callback = async () => {
		await tokenService.deleteToken(target.id)

		openToast({ label: "Token successfully deleted" })
	}

	popupStore.open("confirm")
}

watch(
	() => props.show,
	async () => {
		if (props.show) {
			if (route.params.id) {
				tokens.value = await tokenService.getTokens(appStore.profile.id, appStore.network.chainId)
			}
		} else {
			tokens.value = []
			tokenService.disconnect()
		}
	},
)
</script>

<template>
	<Popup :show @onClose="emit('onClose')" :displaceIdx="popupStore.popups.tokens?.order">
		<PopupCard :displaceIdx>
			<Flex wide direction="column" gap="16" :class="$style.wrapper">
				<Flex direction="column" gap="16">
					<Text size="14" weight="600" color="primary"> Manage tokens </Text>

					<Flex v-if="tokens.length" direction="column" gap="6">
						<Flex
							v-for="token in tokens"
							align="center"
							justify="between"
							gap="16"
							:class="$style.card"
						>
							<Flex align="center" gap="8" :class="$style.left">
								<Icon name="banknote" size="16" color="primary" />
								<Text size="14" weight="600" color="primary">
									{{ token.symbol }}
								</Text>
								<Text size="14" weight="600" color="tertiary" :class="$style.label">
									{{ token.name }}
								</Text>
							</Flex>

							<Flex align="center" gap="8" :class="$style.icons">
								<Icon
									@click="handleEditToken(token)"
									name="edit"
									size="14"
									color="secondary"
									:class="$style.icon_btn"
								/>
								<Icon
									@click="handleDeleteToken(token)"
									name="close-circle"
									size="14"
									color="secondary"
									:class="$style.icon_btn"
								/>
							</Flex>
						</Flex>
					</Flex>

					<Button v-else type="secondary" size="small" disabled> There is no tokens </Button>
				</Flex>

				<Button
					@click="popupStore.open('new_token')"
					wide
					type="secondary"
					size="medium"
					leftIcon="plus-circle"
					leftIconColor="primary"
				>
					New token
				</Button>
			</Flex>
		</PopupCard>
	</Popup>
</template>

<style module>
.wrapper {
	flex: 1;

	padding: 0 20px 24px 20px;
}

.card {
	border-radius: 12px;
	cursor: pointer;
	box-shadow: inset 0 0 0 1px var(--border), 0 1px 2px var(--shadow-5);

	padding: 12px;

	transition: all 0.2s var(--bezier);

	&:hover {
		background: var(--gray-3);
		box-shadow: inset 0 0 0 1px var(--border-hovered), 0 1px 2px var(--shadow-5);
	}

	&:active {
		background: var(--gray-5);
	}

	&:hover .icons {
		opacity: 1;
	}
}

.left {
	min-width: 0;
	overflow: hidden;
}

.label {
	overflow: hidden;
	text-overflow: ellipsis;
}

.icons {
	opacity: 0;

	transition: all 0.2s var(--bezier);
}

.icon_btn {
	transition: all 0.2s var(--bezier);

	&:hover {
		fill: var(--txt-primary);
	}
}
</style>
