<route lang="json">
{
	"meta": {
		"isAuthRequired": true
	}
}
</route>

<script setup>
/** Components */
import Navigation from "../../../../components/Navigation.vue"

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

const accounts = computed(() => appStore.accounts.filter(a => a.visible).sort((a, b) => a.index - b.index))
const hiddenAccounts = computed(() => appStore.accounts.filter(a => !a.visible))

const handleSelectAccount = acc => {
	appStore.selectAccount(acc)
	appStore.syncBalances()
}

const handleEditAccount = target => {
	cacheStore.accountToEditIdx = target.address
	popupStore.open("edit_account")
}

const handleHideAccount = acc => {
	appStore.changeAccountVisibility(acc, false)
	openToast({ label: "Account successfully hidden" })
}

const handleShowAccount = acc => {
	appStore.changeAccountVisibility(acc, true)
	openToast({ label: "Account visible again" })
}

const handleCopyAddress = target => {
	window.navigator.clipboard.writeText(target)
	openToast({ label: "Address is copied", icon: "copy" })
}
</script>

<template>
	<Flex direction="column" gap="12" :class="$style.wrapper">
		<Flex align="center" gap="8">
			<RouterLink to="/popup/settings">
				<Text size="13" weight="600" color="tertiary" style="line-height: 16px"> Settings </Text>
			</RouterLink>
			<Text color="support">•</Text>
			<RouterLink to="/popup/settings/security">
				<Text size="13" weight="600" color="tertiary" style="line-height: 16px"> Security </Text>
			</RouterLink>
			<Text color="support">•</Text>
			<Text size="13" weight="600" color="tertiary" style="line-height: 16px"> Accounts </Text>
		</Flex>

		<Flex direction="column" gap="40">
			<Flex direction="column" gap="16">
				<Text size="16" weight="600" color="primary">
					Accounts &nbsp;<Text color="tertiary">{{ appStore.accounts.length }} </Text>
				</Text>

				<Flex direction="column" gap="6">
					<Flex
						v-for="acc in accounts"
						@click="handleSelectAccount(acc)"
						align="center"
						justify="between"
						:class="$style.card"
					>
						<Flex align="center" gap="10">
							<Icon
								:name="acc?.address === appStore.account?.address ? 'check-circle' : 'vault'"
								size="16"
								:color="acc?.address === appStore.account?.address ? 'green' : 'primary'"
							/>

							<Text size="14" weight="600" color="primary" :class="$style.account_name">
								{{ acc.name }}
							</Text>

							<Text
								@click.stop="handleCopyAddress(acc.address)"
								size="13"
								weight="600"
								color="tertiary"
								class="copyable"
								:class="$style.account_address"
							>
								{{ acc.address.slice(0, 6) }}
								<Text color="dark">•••</Text>
								{{ acc.address.slice(-4) }}
							</Text>
						</Flex>

						<Flex align="center" gap="8" :class="$style.icons">
							<Icon
								@click.stop="handleEditAccount(acc)"
								name="edit"
								size="14"
								color="tertiary"
								:class="$style.icon_btn"
							/>
							<Icon
								@click.stop="handleHideAccount(acc)"
								name="close-circle"
								size="14"
								color="tertiary"
								:class="$style.icon_btn"
							/>
						</Flex>
					</Flex>
				</Flex>

				<Button
					@click="popupStore.open('new_account')"
					wide
					type="secondary"
					size="medium"
					leftIcon="plus-circle"
					leftIconColor="primary"
				>
					<Text size="13">New account</Text>
				</Button>
			</Flex>

			<Flex v-if="hiddenAccounts.length" direction="column" gap="16">
				<Flex direction="column" gap="6">
					<Flex align="center" justify="between">
						<Text size="13" weight="600" color="body"> Hidden accounts </Text>

						<Text size="13" weight="600" color="secondary">
							{{ hiddenAccounts.length }}
						</Text>
					</Flex>

					<Flex
						v-for="acc in hiddenAccounts"
						@click="handleShowAccount(acc)"
						align="center"
						justify="between"
						:class="$style.card"
					>
						<Flex align="center" gap="10">
							<Icon
								:name="acc?.address === appStore.account?.address ? 'check-circle' : 'vault'"
								size="16"
								:color="acc?.address === appStore.account?.address ? 'green' : 'tertiary'"
							/>

							<Text size="14" weight="600" color="secondary" :class="$style.account_name">
								{{ acc.name }}
							</Text>

							<Text
								@click.stop="handleCopyAddress(acc.address)"
								size="13"
								weight="600"
								color="tertiary"
								class="copyable"
							>
								{{ acc.address.slice(0, 6) }}
								<Text color="dark">•••</Text>
								{{ acc.address.slice(-4) }}
							</Text>
						</Flex>

						<Icon name="arrow-back-up" size="14" color="secondary" />
					</Flex>
				</Flex>

				<Flex align="center" gap="4">
					<Icon name="info" size="12" color="support" />
					<Text size="12" weight="600" color="support"> Click on the account you want to make visible </Text>
				</Flex>
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

	padding: 20px 24px 80px 24px;
}

.card {
	border-radius: 12px;
	cursor: pointer;
	box-shadow: inset 0 0 0 1px var(--border), 0 1px 2px var(--shadow-5);

	padding: 12px 16px 12px 12px;

	transition: all 0.2s var(--bezier);

	&:hover {
		background: var(--gray-3);
		box-shadow: inset 0 0 0 1px var(--border-hovered), 0 1px 2px var(--shadow-5);

		& .icons {
			opacity: 1;
		}
	}

	&:active {
		background: var(--gray-5);
	}
}

.account_name {
	max-width: 120px;

	text-wrap: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.account_address {
	max-width: 110px;

	text-wrap: nowrap;
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
