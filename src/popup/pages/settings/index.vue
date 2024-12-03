<script setup>
/** Components */
import Navigation from "../../components/Navigation.vue"

/** Composables */
import { useToast } from "@/composables/toast"
const { openToast } = useToast()

/** Store */
import { useAppStore } from "@/stores/app.store"
import { useCacheStore } from "@/stores/cache.store"
import { usePopupStore } from "@/stores/popup.store"
const appStore = useAppStore()
const cacheStore = useCacheStore()
const popupStore = usePopupStore()

const router = useRouter()

onMounted(() => {
	if (!appStore.isLogined && appStore.isSessionChecked)
		router.push("/popup/auth")
})

watch(
	() => appStore.isSessionChecked,
	() => {
		if (!appStore.isLogined && appStore.isSessionChecked)
			router.push("/popup/auth")
	}
)

const handleCopyAddress = () => {
	window.navigator.clipboard.writeText(appStore.account.address)
	openToast({ label: "Address is copied", icon: "copy" })
}

const handleEditCurrentAccount = () => {
	cacheStore.accountToEditIdx = appStore.account.address
	popupStore.open("edit_account")
}
</script>

<template>
	<Flex
		v-if="appStore.isLogined"
		direction="column"
		gap="12"
		:class="$style.wrapper"
	>
		<Text
			size="13"
			weight="600"
			color="secondary"
			style="line-height: 16px"
		>
			Settings
		</Text>

		<Flex direction="column" justify="between" :class="$style.wallet">
			<Flex justify="between">
				<Icon name="vault" size="24" color="primary" />

				<Button
					@click="handleEditCurrentAccount"
					type="secondary"
					size="mini"
					>Edit</Button
				>
			</Flex>

			<Flex justify="between" align="end">
				<Flex direction="column" gap="6">
					<Text size="13" weight="600" color="primary">
						{{ appStore.account.name }}
					</Text>
					<Text
						@click="handleCopyAddress"
						size="12"
						weight="600"
						color="tertiary"
						class="copyable"
					>
						{{ appStore.account.address.slice(0, 6) }}
						•••
						{{ appStore.account.address.slice(-4) }}
					</Text>
				</Flex>
			</Flex>
		</Flex>

		<Flex direction="column" justify="between" style="flex: 1">
			<Flex direction="column" gap="8">
				<RouterLink to="/popup/settings/general">
					<Flex align="center" justify="between" :class="$style.item">
						<Flex gap="10">
							<Icon name="settings" size="16" color="secondary" />

							<Flex direction="column" gap="6">
								<Text size="14" weight="600" color="primary">
									General
								</Text>
								<Text size="13" weight="500" color="tertiary">
									Select theme, set up notifications
								</Text>
							</Flex>
						</Flex>

						<Icon
							name="chevron"
							size="16"
							color="tertiary"
							:class="$style.item_icon"
						/>
					</Flex>
				</RouterLink>

			<RouterLink to="/popup/settings/dappSessions">
				<Flex align="center" justify="between" :class="$style.item">
					<Flex gap="10">
						<Icon name="dapp" size="15" color="secondary" />

						<Flex direction="column" gap="6" :style="{paddingLeft: '1px'}">
							<Text size="14" weight="600" color="primary">
								Dapp Sessions
							</Text>
							<Text size="13" weight="500" color="tertiary">
								Connect dApps and manage sessions
							</Text>
						</Flex>
					</Flex>

					<Icon
						name="chevron"
						size="16"
						color="tertiary"
						:class="$style.item_icon"
					/>
				</Flex>
			</RouterLink>

				<RouterLink to="/popup/settings/developer">
					<Flex align="center" justify="between" :class="$style.item">
						<Flex gap="10">
							<Icon
								name="developer"
								size="16"
								color="secondary"
							/>

							<Flex direction="column" gap="6">
								<Text size="14" weight="600" color="primary">
									Developer
								</Text>
								<Text size="13" weight="500" color="tertiary">
									Modify networks, endpoints, etc
								</Text>
							</Flex>
						</Flex>

						<Icon
							name="chevron"
							size="16"
							color="tertiary"
							:class="$style.item_icon"
						/>
					</Flex>
				</RouterLink>

				<RouterLink to="/popup/settings/security">
					<Flex align="center" justify="between" :class="$style.item">
						<Flex gap="10">
							<Icon
								name="key-circle"
								size="16"
								color="secondary"
							/>

							<Flex direction="column" gap="6">
								<Text size="14" weight="600" color="primary">
									Security
								</Text>
								<Text size="13" weight="500" color="tertiary">
									Password and account managemenet
								</Text>
							</Flex>
						</Flex>

						<Icon
							name="chevron"
							size="16"
							color="tertiary"
							:class="$style.item_icon"
						/>
					</Flex>
				</RouterLink>

				<RouterLink to="/popup/settings/about">
					<Flex align="center" justify="between" :class="$style.item">
						<Flex algin="center" gap="10">
							<Icon name="logo" size="16" color="secondary" />

							<Text size="14" weight="600" color="primary">
								About Wallet
							</Text>
						</Flex>

						<Icon
							name="chevron"
							size="16"
							color="tertiary"
							:class="$style.item_icon"
						/>
					</Flex>
				</RouterLink>
			</Flex>
		</Flex>

		<Navigation />
	</Flex>
</template>

<style module>
.wrapper {
	flex: 1;

	background: var(--card-bg);
	border-top: 2px solid var(--gray-8);
	box-shadow: inset 0 10px 8px -2px var(--gray-3);

	border-top-left-radius: 24px;
	border-top-right-radius: 24px;

	padding: 20px 24px 80px 24px;
}

.wallet {
	min-height: 140px;

	background: linear-gradient(transparent, var(--gray-3));
	border-radius: 12px;
	box-shadow: inset 0 0 0 1px var(--gray-10);

	padding: 16px;
}

.item {
	border-radius: 12px;
	box-shadow: inset 0 0 0 1px var(--gray-10);
	cursor: pointer;

	padding: 12px;

	transition: all 0.2s var(--bezier);

	&:hover {
		background: var(--gray-3);

		& .item_icon {
			transform: rotate(-90deg) translateY(3px);
		}
	}

	&:active {
		background: var(--gray-5);
	}
}

.item_icon {
	transform: rotate(-90deg);

	transition: transform 0.2s var(--bezier);
}
</style>
