<script setup>
/** Components */
import Navigation from "../../../components/Navigation.vue"

/** Utils */
import { managers } from "@/utils/core"

/** Store */
import { useAppStore } from "@/stores/app.store"
import { usePopupStore } from "@/stores/popup.store"
const appStore = useAppStore()
const popupStore = usePopupStore()

const router = useRouter()

if (!appStore.isLogined) {	
	const redirect = `${window.location.pathname}${window.location.hash}`
	
	router.push({
		path: "/popup/auth",
		query: { redirect },
	})
}

console.log('appStore', appStore);

const dappSessions = computed(() => {
	const arr = [...appStore.dappSessions]
	for (let index = 0; index < arr.length; index++) {
		const el = arr[index]
		el.imageLoaded = !!el.icon
	}

	return arr
})

const onImageError = (ds) => {
	ds.imageLoaded = false
}

const handleOpenConnectByURIPopup = () => {
	if (!appStore.isLogined) return
	popupStore.open("connectByURI")
}

const handleDropSession = (session) => {
	managers.wallectConnect.dropDappSession(session)
}
</script>

<template>
	<Flex direction="column" justify="between" :class="$style.wrapper">
		<Flex direction="column" gap="16">
			<Flex align="center" gap="8">
				<RouterLink to="/popup/settings">
					<Text
						size="13"
						weight="600"
						color="tertiary"
						style="line-height: 16px"
					>
						Settings
					</Text>
				</RouterLink>
				<Text color="support">•</Text>
				<RouterLink to="/popup/settings/dappSessions">
					<Text
						size="13"
						weight="600"
						color="tertiary"
						style="line-height: 16px"
					>
						Dapp Sessions
					</Text>
				</RouterLink>
			</Flex>
			<Flex direction="column" gap="16">
				<Text size="16" weight="600" color="primary">Sessions</Text>

				<Flex v-if="dappSessions.length" direction="column" gap="6" :class="$style.sessions_section">
					<Flex
						v-for="ds in dappSessions"
						align="center"
						justify="between"
						:class="$style.session"
					>
						<Flex align="center" gap="10">
							<div v-if="ds.imageLoaded" :class="$style.avatar_container">
								<img
									:src="ds.icon"
									alt="Icon"
									@error="onImageError(ds)"
									:class="$style.avatar_image"
								/>
							</div>
							<Icon
								v-else
								name="dapp"
								size="22"
								color="blue"
							/>

							<Text size="15" weight="600" color="primary">
								{{ ds.name }}
							</Text>
						</Flex>
						
						<Flex
							align="center"
							gap="8"
							:class="$style.icons"
						>
							<Icon
								@click.stop="handleDropSession(ds)"
								name="close-circle"
								size="16"
								color="tertiary"
							/>
						</Flex>
					</Flex>
				</Flex>

				<Flex v-else direction="column" align="center" justify="center" gap="6" :style="{marginTop: '72px'}">
					<Text size="13" weight="600" color="secondary">There are no active sessions</Text>
					<Text size="13" color="secondary">You can connect dApp directly by URI</Text>
				</Flex>
			</Flex>
		</Flex>

		<Flex direction="column" gap="6" :class="$style.uri_connect_section">
			<Button
				@click="handleOpenConnectByURIPopup"
				wide
				type="secondary"
				size="medium"
				leftIcon="arrow-right-circle"
				leftIconColor="blue"
			>
				<Text size="13">Connect new Dapp</Text>
			</Button>

			<Navigation />
		</Flex>
	</Flex>
</template>

<style module>
.wrapper {
	max-height: var(--base-height);
	flex: 1;

	background: #fff;
	box-shadow: 0 0 0 1px var(--gray-5);

	border-top-left-radius: 24px;
	border-top-right-radius: 24px;

	padding: 20px 24px 24px 24px;
}

.sessions_section {
	max-height: calc(var(--base-height) - 280px);
	overflow-y: auto;

	scrollbar-width: thin;
	/* scrollbar-color: #888 #f1f1f1; */
}

/* .sessions_section::-webkit-scrollbar {
	width: 4px;
} */

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


/* *::-webkit-scrollbar-track {
}

*::-webkit-scrollbar-thumb {
	background-color: rgba(255, 255, 255, 0);
	border-radius: 50px;
}

*::-webkit-scrollbar-thumb {
	background-color: rgba(255, 255, 255, 0.15);
}

*::-webkit-scrollbar-corner {
	background-color: transparent;
} */

</style>
