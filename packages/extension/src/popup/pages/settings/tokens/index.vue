<route lang="json">
{
	"meta": {
		"isAuthRequired": true
	}
}
</route>

<script setup>
/** Components */

/** Services */
import { TokenServiceClient } from "@/wallet/services/token/client"

/** Utils */
import { stringCompare } from "@/utils/string"

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
	const idx = tokens.value.findIndex((t) => t.id === token.id)
	if (idx === -1) return

	tokens.value.splice(idx, 1)
}

const handleEdit = (target) => {
	cacheStore.tokenToEditIdx = target.id
	popupStore.open("edit_token")
}

const handleDelete = (target) => {
	cacheStore.confirm.confirm_color = "red"
	cacheStore.confirm.confirm_text = "Yes, delete token"
	cacheStore.confirm.title = "Remove this token?"
	cacheStore.confirm.description = "Removing a token only affects the display in the interface and it does not affect the token balance"
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
	},
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
		<SubPageHeader title="Manage Tokens" :backTo="'/popup/settings'" />

		<Flex direction="column" gap="16" :class="$style.content">
			<SectionLabel label="Tokens" :count="tokens.length" />

			<ItemsContainer v-if="tokens.length">
				<SettingItem
					v-for="token in tokens"
					:title="token.symbol"
					:description="token.name"
					icon="banknote"
					raw
					data-testid="token-row"
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
									data-testid="token-delete"
									:class="$style.icon_btn"
								/>

								<template #content> Delete token </template>
							</Tooltip>
						</Flex>
					</template>
				</SettingItem>
			</ItemsContainer>

			<div v-else :class="$style.empty">
				<span :class="$style.empty_headline">NO TOKENS YET</span>
				<span :class="$style.empty_sub">Import tokens to track balances and send or receive.</span>
			</div>

			<Button @click="popupStore.open('new_token')" wide type="primary" size="large">
				Import token
			</Button>
		</Flex>

	</Flex>
</template>

<style module>
.wrapper {
	flex: 1;
	overflow: auto;
	background: var(--app-bg);
	scrollbar-gutter: stable;
}

.content {
	padding: 16px 24px var(--nav-clearance) 24px;
}

.icon_btn {
	cursor: pointer;

	transition: all 0.2s var(--bezier);

	&:hover {
		fill: var(--txt-primary);
	}
}

.empty {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 8px;

	padding: 32px 16px;
	border: 1px dashed var(--nulo-border);

	text-align: center;
}

.empty_headline {
	font-family: var(--font-headline);
	font-size: 14px;
	font-weight: 700;
	letter-spacing: 0.1em;
	text-transform: uppercase;
	color: var(--nulo-secondary);
}

.empty_sub {
	font-family: var(--font-mono);
	font-size: 11px;
	line-height: 1.4;
	color: var(--nulo-outline);
}
</style>
