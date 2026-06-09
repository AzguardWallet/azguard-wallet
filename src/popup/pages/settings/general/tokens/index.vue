<route lang="json">
{
	"meta": {
		"title": "Manage tokens",
		"isAuthRequired": true
	}
}
</route>

<script setup>
/** Services */
import { TokenServiceClient } from "@/wallet/services/token/client"

/** Components */
import Navigation from "../../../../components/Navigation.vue"
import Breadcrumbs from "@/components/ui/Settings/Breadcrumbs.vue"
import ItemsContainer from "@/components/ui/Settings/ItemsContainer.vue"
import SettingItem from "@/components/ui/Settings/SettingItem.vue"

/** Utils */
import { stringCompare} from "@/utils/string"

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

const handleEdit = target => {
	cacheStore.tokenToEditIdx = target.id
	popupStore.open("edit_token")
}

const handleDelete = target => {
	cacheStore.confirm.confirm_color = "red"
	cacheStore.confirm.confirm_text = "Yes, delete token"
	cacheStore.confirm.title = "Remove this token?"
	cacheStore.confirm.description =
		"Removing a token only affects the display in the interface and it does not affect the token balance"
	cacheStore.confirm.callback = async () => {
		await tokenService.deleteToken(target.id)
		openToast({ label: "Token successfully deleted" })
	}

	popupStore.open("confirm")
}

watch(
	() => tokens.value.length,
	() => {
		tokens.value = [...tokens.value].sort((a, b) => stringCompare(a.name, b.name))
	}
)

onMounted(async () => {
	tokens.value = await tokenService.getTokens(appStore.profile.id, appStore.network.chainId)
})
onBeforeUnmount(() => {
	tokenService.disconnect()
})
</script>

<template>
	<Flex direction="column" :class="$style.wrapper">
		<TestnetAlert />

		<Flex direction="column" gap="20" :class="$style.wrapper_inner">
			<Breadcrumbs />

			<Flex direction="column" gap="16">
				<Text size="13" weight="600" color="primary">
					Tokens &nbsp;<Text color="tertiary">{{ tokens.length }} </Text>
				</Text>

				<ItemsContainer>
					<SettingItem
						v-for="token in tokens"
						size="large"
						:title="token.symbol"
						:description="token.name"
						icon="banknote"
						raw
					>
						<template #right>
							<Flex align="center" gap="8">
								<Tooltip position="end" delay="350">
									<Icon
										@click.stop="handleEdit(token)"
										name="edit"
										size="14"
										color="tertiary"
										:class="$style.icon_btn"
									/>

									<template #content> Edit token </template>
								</Tooltip>

								<Tooltip position="end" delay="350">
									<Icon
										v-if="appStore.networks.length > 1"
										@click.stop="handleDelete(token)"
										name="close-circle"
										size="14"
										color="tertiary"
										:class="$style.icon_btn"
									/>

									<template #content> Delete token </template>
								</Tooltip>
							</Flex>
						</template>
					</SettingItem>
				</ItemsContainer>

				<Button
					@click="popupStore.open('new_token')"
					wide
					type="secondary"
					size="medium"
					leftIcon="plus-circle"
					leftIconColor="primary"
				>
					<Text size="13">New token</Text>
				</Button>
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
	border-top: 2px solid var(--gray-8);
	box-shadow: inset 0 10px 8px -2px var(--gray-3);

	border-top-left-radius: 24px;
	border-top-right-radius: 24px;
}

.wrapper_inner {
	flex: 1;

	padding: 20px 24px 80px 24px;
}

.icon_btn {
	cursor: pointer;

	transition: all 0.2s var(--bezier);

	&:hover {
		fill: var(--txt-primary);
	}
}
</style>
