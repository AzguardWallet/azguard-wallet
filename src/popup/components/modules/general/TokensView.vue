<script setup>
/** Components */
import TokenCard from "./TokenCard.vue"
import { Dropdown, DropdownItem, DropdownDivider } from "@/components/ui/Dropdown"

/** Utils */
import { managers } from "@/utils/core.js"
import ItemsContainer from "@/components/ui/Settings/ItemsContainer.vue"

/** Composables */
import { useSettings } from "@/composables/settings.js"
const { settings } = useSettings()

/** Store */
import { useAppStore } from "@/stores/app.store"
import { usePopupStore } from "@/stores/popup.store"
const appStore = useAppStore()
const popupStore = usePopupStore()

const router = useRouter()

const handleRefreshBalances = () => {
	for (const token of appStore.tokens) {
		if (appStore.tokensAwaitingBalanceRefresh.includes(token.id)) continue
		appStore.tokensAwaitingBalanceRefresh.push(token.id)
		managers.balance.refreshTokenBalance(token.id)
	}
}
</script>

<template>
	<Flex direction="column" gap="12">
		<Flex align="end" justify="between">
			<Text size="13" weight="600" color="secondary"> Tokens </Text>

			<Flex align="center" gap="6">
				<Dropdown>
					<Button type="secondary" size="micro">
						<Icon name="dots" size="12" color="secondary" />
					</Button>

					<template #popup>
						<DropdownItem @click="popupStore.open('new_token')">
							<Flex align="center" gap="8">
								<Icon name="plus-circle" size="14" color="primary" />
								Import token
							</Flex>
						</DropdownItem>
						<DropdownItem @click="router.push('/popup/settings/general/tokens')">
							<Flex align="center" gap="8">
								<Icon name="settings" size="14" color="primary" />
								Manage tokens
							</Flex>
						</DropdownItem>
						<DropdownDivider />
						<DropdownItem disabled>
							<Flex align="center" gap="8">
								<Icon name="display" size="14" color="primary" />
								Display settings
							</Flex>
						</DropdownItem>
						<DropdownDivider />
						<DropdownItem @click="handleRefreshBalances">
							<Flex align="center" gap="8">
								<Icon name="refresh" size="14" color="primary" />
								Refresh balances
							</Flex>
						</DropdownItem>
					</template>
				</Dropdown>
			</Flex>
		</Flex>

		<template v-if="appStore.tokens.length || appStore.dummyTokens.length">
			<ItemsContainer>
				<TokenCard v-for="token in [...appStore.tokens, ...appStore.dummyTokens]" :token />
			</ItemsContainer>
		</template>
		<template v-else>
			<Button @click="popupStore.open('new_token')" type="secondary" size="small" leftIcon="plus-circle">
				New token
			</Button>
		</template>
	</Flex>
</template>
