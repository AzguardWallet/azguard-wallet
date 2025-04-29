<route lang="json">
{
	"meta": {
		"title": "Sessions",
		"isAuthRequired": true
	}
}
</route>

<script setup>
/** Components */
import Navigation from "../../../../components/Navigation.vue"
import Breadcrumbs from "@/components/ui/Settings/Breadcrumbs.vue"
import PageHeader from "@/components/ui/Settings/PageHeader.vue"
import ItemsContainer from "@/components/ui/Settings/ItemsContainer.vue"
import SettingItem from "@/components/ui/Settings/SettingItem.vue"

/** Utils */
import { DappSessionServiceClient } from "@/wallet/services/dapp-session/client"

/** Store */
import { useAppStore } from "@/stores/app.store"
import { usePopupStore } from "@/stores/popup.store"
const appStore = useAppStore()
const popupStore = usePopupStore()

const router = useRouter()

const dappSessions = computed(() => {
	const arr = [...appStore.dappSessions]
	for (let index = 0; index < arr.length; index++) {
		const el = arr[index]
		el.imageLoaded = !!el.dappMetadata.icon
	}

	return arr
})

const onImageError = ds => {
	ds.imageLoaded = false
}

const handleOpenConnectByURIPopup = () => {
	if (!appStore.isLogined) return
	popupStore.open("connect_by_uri")
}

const handleDropSession = session => {
	dappSessionServiceClient.deleteDappSession(session.id)
}

const handleDropAllSessions = () => {
	for (const session of dappSessions.value) {
		handleDropSession(session)
	}
}

const dappSessionServiceClient = new DappSessionServiceClient()
</script>

<template>
	<Flex direction="column" justify="between" :class="$style.wrapper">
		<Flex direction="column" gap="24">
			<Breadcrumbs hide-title />

			<PageHeader title="Sessions" icon="plug-circle" iconColor="sand" />

			<Flex direction="column" gap="16">
				<Flex align="center" justify="end" wide>
					<Tooltip v-if="dappSessions.length" position="end">
						<Icon
							@click="handleDropAllSessions"
							name="log-out"
							size="16"
							color="tertiary"
							:class="$style.disconnect_all"
						>
							Disconnect All
						</Icon>

						<template #content>
							<Text size="12" color="secondary">Disconnect all dApps</Text>
						</template>
					</Tooltip>
				</Flex>
				
				<Flex v-if="dappSessions.length" direction="column" gap="6" :class="$style.sessions_section">
					<Flex
						v-for="ds in dappSessions"
						@click="router.push(`/popup/settings/general/sessions/session/${ds.id}`)"
						align="center"
						justify="between"
						:class="$style.session"
					>
						<Flex align="center" gap="10">
							<div v-if="ds.imageLoaded" :class="$style.avatar_container">
								<img
									:src="ds.dappMetadata.icon"
									@error="onImageError(ds)"
									:class="$style.avatar_image"
								/>
							</div>
							<Icon v-else name="dapp" size="22" color="blue" />

							<Text size="15" weight="600" color="primary">
								{{ ds.dappMetadata.name }}
							</Text>
						</Flex>

						<Flex align="center" gap="8" :class="$style.icons">
							<Icon @click.stop="handleDropSession(ds)" name="close-circle" size="16" color="tertiary" />
						</Flex>
					</Flex>
				</Flex>

				<Flex v-else direction="column" ap align="center" gap="12" :class="$style.empty_banner">
					<Icon name="plug-circle" size="20" color="tertiary" />

					<Flex direction="column" align="center" gap="6">
						<Text size="13" weight="600" color="secondary" align="center">
							There are no active sessions
						</Text>
						<Text size="12" weight="500" height="140" color="tertiary" align="center">
							You can connect dApp directly by URI
						</Text>
					</Flex>
				</Flex>
			</Flex>
		</Flex>

		<Flex direction="column" gap="6" :class="$style.uri_connect_section">
			<Button @click="handleOpenConnectByURIPopup" wide type="secondary" size="medium" leftIcon="plug-circle">
				Connect new Dapp
			</Button>

			<Navigation />
		</Flex>
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

	padding: 20px 24px 24px 24px;
}

.disconnect_all {
	cursor: pointer;

	&:hover {
		fill: var(--red);
	}
}

.sessions_section {
	max-height: calc(var(--base-height) - 265px);
	overflow: auto;
}

.uri_connect_section {
	margin-bottom: 48px;
}

.session {
	border-radius: 12px;
	cursor: pointer;
	box-shadow: inset 0 0 0 1px var(--gray-10), 0 1px 2px var(--gray-5);

	padding: 12px;

	transition: all 0.2s var(--bezier);

	&:hover {
		background: var(--gray-3);

		& .icons {
			opacity: 1;
		}
	}

	&:active {
		background: var(--gray-5);
	}
}

.avatar_container {
	position: relative;
	width: 22px;
	height: 22px;
	overflow: hidden;
	border-radius: 50%;
}

.avatar_image {
	width: 100%;
	height: 100%;
	object-fit: cover;
}

.icons {
	opacity: 0;

	transition: all 0.2s var(--bezier);
}

.empty_banner {
	max-width: 250px;

	margin: 40px auto 0 auto;
}
</style>
