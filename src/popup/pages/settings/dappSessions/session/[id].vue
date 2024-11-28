<script setup>
/** Vendor */
import { onMounted, onUnmounted } from "vue"

/** Components */
import Navigation from "../../../../components/Navigation.vue"

/** Utils */
import { managers } from "@/utils/core"
import { WalletConnectServiceClient } from "@/wallet/services/wallet-connect/client"

/** Store */
import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()

const route = useRoute()
const router = useRouter()

const session = ref()
const fetchSession = async () => {
	console.log('dapp session page route', route);
	
	const id = route.params.id
	console.log('id', id);
	
	session.value = await managers.interaction.getDappSession(id)
	if (!session.value) {
		router.push('/popup/settings/dappSessions')
		return
	}

	session.value.imageLoaded = !!session.value.icon
	console.log('dapp session page session', session.value);
}

const onImageError = () => {
	session.value.imageLoaded = false
}


// const params = ref()
// const requestId = ref()
// params.value = new URLSearchParams(window.location.search)
// requestId.value = params.value.get('requestId')

// if (!appStore.isLogined) {	
// 	const redirect = `${window.location.pathname}${window.location.hash}?${params.toString()}`

// 	console.log('!appStore.isLogined', route, redirect);	
	
// 	router.push({
// 		path: "/popup/auth",
// 		query: { redirect },
// 	})
// }

// const profile = await managers.profile.getActiveProfile()
// const networks = await managers.network.getNetworks()
// const accountServiceClient = new AccountServiceClient(profile, networks[1])
// const accounts = await accountServiceClient.getAccounts()


const handleDropSession = () => {
	managers.wallectConnect.dropDappSession(session.value)

	router.push('/popup/settings/dappSessions')
}

onMounted( async () => {
	await fetchSession()
	// if (appStore.account) selectedAccounts.value.push(appStore.account)

	// window.addEventListener("beforeunload", handleWindowClose)
})

onUnmounted(() => {
	// window.removeEventListener("beforeunload", handleWindowClose);
})
</script>

<template>
	<Flex direction="column" gap="16" :class="$style.wrapper">
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
			<Text color="support">•</Text>
			<Text
				size="13"
				weight="600"
				color="tertiary"
				style="line-height: 16px"
			>
				{{ session?.name }}
			</Text>
		</Flex>

		<Flex direction="column" justify="between" :class="$style.session">
			<Flex justify="between">
				<Flex align="start" justify="start">
					<img
						v-if="session?.imageLoaded"
						:src="session?.icon"
						@error="onImageError()"
						width="48"
						height="48"
					/>

					<Icon
						v-else
						name="dapp"
						size="48"
						color="blue"
					/>
				</Flex>

				<Button @click="handleDropSession" type="secondary" size="mini">Disconnect</Button>
			</Flex>

			<Flex justify="between" align="end">
				<Flex direction="column" gap="6">
					<Text size="13" weight="600" color="primary">
						{{ session?.name }}
					</Text>
					<Text size="12" weight="600" color="tertiary" selectable>
						{{ session?.url }}
					</Text>
				</Flex>
			</Flex>
		</Flex>

		<Flex direction="column" align="start" justify="start" gap="8" :class="$style.accounts_section">
			<Text size="15" weight="600" color="primary">Shared accounts</Text>

			<Flex direction="column" align="start" justify="start" gap="6" :class="$style.accounts">
				<Flex v-for="acc in session?.accounts" gap="10" :class="$style.account">
					<!-- <Flex align="center">
						<Icon v-if="selectedAccounts.includes(acc)" name="check-circle" size="16" color="green" />
						<Icon v-else name="circle" size="16" color="secondary" />
					</Flex>				 -->
					<Flex direction="column" gap="4">
						<Text size="14" weight="600" color="primary">
							{{ acc.name }}
						</Text>
						<Text size="13" weight="600" color="tertiary">
							$0.00
							<Text color="support">•</Text>
							{{ `${acc.address.slice(0, 6)}...${acc.address.slice(-4)}` }}
						</Text>
					</Flex>
				</Flex>
			</Flex>
		</Flex>

		<Flex direction="column" align="start" justify="start" gap="8">
			<Text size="15" weight="600" color="primary">Session allowances:</Text>

			<Flex align="center" gap="4">
				<Text size="13" color="secondary">Networks:</Text>
				<Text size="13" color="secondary"> {{ session?.params.chains.join(', ') }} </Text>
			</Flex>
			
			<Flex align="center" gap="4">
				<Text size="13" color="secondary">Methods:</Text>
				<Text size="13" color="secondary"> {{ session?.params.methods.join(', ') }} </Text>
			</Flex>

			<Flex align="center" gap="4">
				<Text size="13" color="secondary">Events:</Text>
				<Text size="13" color="secondary"> {{ session?.params.events.join(', ') }} </Text>
			</Flex>
		</Flex>


		<!-- <Flex direction="column" gap="14">
			<Flex align="center" justify="center" gap="8" :style="{paddingTop: '8px'}">
				<Text size="16" weight="600" color="primary">Connection proposal</Text>
			</Flex>
			<Flex align="center" justify="center" gap="20">
				<Flex
					direction="column"
					align="center"
					justify="center"
					gap="6"
					:class="[$style.wallet, $style.connected]"
				>
					<img v-if="dapp?.icons[0]" width="48" height="48" :src="dapp?.icons[0]" />

					<Icon
						v-else
						name="dapp"
						size="48"
						color="blue"
					/>

					<Text size="13" weight="600" color="primary"> {{ dapp?.name }} </Text>
				</Flex>

				<Flex align="center" gap="12" :class="allConnected && $style.ready_icon" :style="{paddingBottom: '13px'}">
					<Icon name="left-connect" size="24" color="tertiary" />
					<Icon name="right-connect" size="24" color="tertiary" />
				</Flex>

				<Flex
					direction="column"
					align="center"
					justify="center"
					gap="6"
					:class="[$style.wallet, $style.connected]"
				>
					<img width="48" height="48" src="@/assets/logo.png" />

					<Text size="13" weight="600" color="primary">Azguard Wallet</Text>
				</Flex>
			</Flex>

			<Flex direction="column" align="center" justify="center" gap="8" :style="{marginTop: '-4px'}">
				<Flex direction="column" align="center" justify="center" gap="4">
					<Text size="13" weight="600" color="primary"> {{ dapp?.url }} </Text>
					<Text size="13" color="primary">would like to connect to your wallet</Text>
				</Flex>
				<Flex direction="column" align="center" justify="center" gap="4">
					<Text size="12" color="secondary">This site is requesting access to view your account address.</Text>
					<Text size="12" color="secondary">Always make sure you trust the sites you interact with.</Text>
				</Flex>
			</Flex>

			<Flex direction="column" align="start" justify="start" gap="4">
				<Text size="15" weight="600" color="primary">Proposal parameters:</Text>

				<Flex align="center" gap="4">
					<Text size="13" color="secondary">Networks:</Text>
					<Text size="13" color="secondary"> {{ chains?.join(', ') }} </Text>
				</Flex>
				
				<Flex align="center" gap="4">
					<Text size="13" color="secondary">Methods:</Text>
					<Text size="13" color="secondary"> {{ methods?.join(', ') }} </Text>
				</Flex>

				<Flex align="center" gap="4">
					<Text size="13" color="secondary">Events:</Text>
					<Text size="13" color="secondary"> {{ events?.join(', ') }} </Text>
				</Flex>
			</Flex>

			<Flex direction="column" align="start" justify="start" gap="12" :class="$style.accounts_section">
				<Flex direction="column" align="start" justify="start" gap="4">
					<Text size="15" weight="600" color="primary">Select accounts</Text>
					<Text size="13" color="secondary">to be connected to the dApp</Text>
				</Flex>
				<Flex direction="column" align="start" justify="start" gap="6" :class="$style.accounts">
					<Flex v-for="acc in accounts" @click="handleAccountSelect(acc)" gap="10" :class="$style.account">
						<Flex align="center">
							<Icon v-if="selectedAccounts.includes(acc)" name="check-circle" size="16" color="green" />
							<Icon v-else name="circle" size="16" color="secondary" />
						</Flex>				

						<Flex direction="column" gap="4">
							<Text size="14" weight="600" color="primary">
								{{ acc.name }}
							</Text>
							<Text size="13" weight="600" color="tertiary">
								$0.00
								<Text color="support">•</Text>
								{{ `${acc.address.slice(0, 6)}...${acc.address.slice(-4)}` }}
							</Text>
						</Flex>
					</Flex>
				</Flex>
			</Flex>
		</Flex> -->

		<Navigation />
	</Flex>
</template>

<style module>
.wrapper {
	flex: 1;

	background: #fff;
	box-shadow: 0 0 0 1px var(--gray-5);

	border-top-left-radius: 24px;
	border-top-right-radius: 24px;

	padding: 20px 24px 24px 24px;
}

.session {
	min-height: 140px;

	background: linear-gradient(transparent, var(--gray-3));
	border-radius: 12px;
	box-shadow: inset 0 0 0 1px var(--gray-10);

	padding: 16px;
}

img {
	border-radius: 50%;
	/* filter: grayscale(1);
	opacity: 0.5; */

	transition: all 0.2s ease;
}

.wallet {
	position: relative;

	width: 50px;
	height: 50px;

	border-radius: 12px;
	background: var(--op-8);

	text-align: center;
  	white-space: nowrap;

	& img {
		border-radius: 50%;
		/* filter: grayscale(1);
		opacity: 0.5; */

		transition: all 0.2s ease;
	}

	& .icon_connectors {
		position: absolute;
		top: -12px;
		right: -12px;
		box-sizing: content-box;

		background: #101010;
		border-radius: 50%;

		padding: 3px;
	}
}

.accounts_section {
	width: 100%;
}

.accounts {
	width: 100%;
	max-height: 160px;
	overflow-y: auto;

	scrollbar-width: thin;
}

.account {
	width: 100%;
	border-radius: 12px;
	/* cursor: pointer; */
	box-shadow: inset 0 0 0 1px var(--gray-10), 0 1px 2px var(--gray-5);

	padding: 8px;

	transition: all 0.2s var(--bezier);

	/* &:hover {
		background: var(--gray-3);
	}

	&:active {
		background: var(--gray-5);
	} */
}
</style>
