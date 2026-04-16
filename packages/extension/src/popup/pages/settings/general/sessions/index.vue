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

/** Services */
import { DappSessionServiceClient } from "@/wallet/services/dapp-session/client"

/** Store */
import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()

/** Composables */
const { loadExternalImage } = useExternalImage()

const router = useRouter()

const GRANT_SHORT_LABELS = {
	accounts: "Accounts",
	contracts: "Contracts",
	contractClasses: "Classes",
	simulation: "Simulation",
	transaction: "Transactions",
	data: "Private data",
}

const formatGrantSummary = (grants) => {
	return grants.map((g) => GRANT_SHORT_LABELS[g.capability.type] ?? g.capability.type).join(" \u00B7 ")
}

const dappSessions = ref([])
const isLoading = ref(true)

const dappSessionService = new DappSessionServiceClient()
dappSessionService.onDappSessionAdded.add(onDappSessionAdded)
dappSessionService.onDappSessionUpdated.add(onDappSessionUpdated)
dappSessionService.onDappSessionDeleted.add(onDappSessionDeleted)
function onDappSessionAdded(session) {
	dappSessions.value.push(session)
}
function onDappSessionUpdated(session) {
	const idx = dappSessions.value.findIndex((ds) => ds.id === session.id)
	if (idx !== -1) {
		dappSessions.value[idx] = session
	} else {
		dappSessions.value.push(session)
	}
}
function onDappSessionDeleted(session) {
	dappSessions.value = dappSessions.value.filter((ds) => ds.id !== session.id)
}

const handleDropSession = (session) => {
	dappSessionService.deleteDappSession(session.id)
}

const handleDropAllSessions = () => {
	for (const session of dappSessions.value) {
		handleDropSession(session)
	}
}

watchEffect(() => {
	dappSessions.value.sort((a, b) => a.expiry - b.expiry)
	dappSessions.value.forEach(async (s) => {
		if (s.dappMetadata.logo) {
			s.loadingLogo = true
			try {
				s.dappMetadata.logoBlobUrl = await loadExternalImage(s.dappMetadata.logo)
			} finally {
				s.loadingLogo = false
			}
		}
	})
})

onBeforeMount(async () => {
	dappSessions.value = await dappSessionService.getDappSessions()

	isLoading.value = false
})
</script>

<template>
	<Flex direction="column" justify="between" :class="$style.wrapper">
		<Flex direction="column" gap="8" :class="$style.section_wrapper">
			<Breadcrumbs hide-title />

			<PageHeader title="Sessions" icon="plug-circle" iconColor="sand" />

			<Flex direction="column" gap="16" :class="$style.section_wrapper">
				<template v-if="!isLoading">
					<Flex v-if="dappSessions.length" align="center" justify="end" gap="10" wide>
						<Tooltip position="end">
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
							<Icon v-if="ds.loadingLogo" :loading="true" name="dapp" size="22" color="tertiary" />
							<div v-else-if="ds.dappMetadata.logoBlobUrl" :class="$style.avatar_container">
								<img
									:src="ds.dappMetadata.logoBlobUrl"
									:class="$style.avatar_image"
								/>
							</div>
							<Icon v-else name="dapp" size="22" color="blue" />

							<Flex direction="column" gap="4">
								<Text size="15" weight="600" color="primary">
									{{ ds.dappMetadata.name }}
								</Text>
								<Text v-if="ds.capabilityGrants?.length" size="11" color="tertiary">
									{{ formatGrantSummary(ds.capabilityGrants) }}
								</Text>
							</Flex>
						</Flex>

						<Flex align="center" gap="8" :class="$style.icons">
							<Icon @click.stop="handleDropSession(ds)" name="close-circle" size="16" color="tertiary" :class="$style.delete_icon" />
						</Flex>
					</Flex>
				</Flex>

                <Flex v-else direction="column" align="center" justify="between" :class="$style.empty_section">
                    <Flex direction="column" align="center" gap="12" :class="$style.empty_banner">
                        <Icon name="plug-circle" size="20" color="tertiary" />

                        <Flex direction="column" align="center" gap="6">
                            <Text size="13" weight="600" color="secondary" align="center">
                                There are no active sessions
                            </Text>
                            <Text size="12" weight="500" height="140" color="tertiary" align="center">
                                dApps connect via the wallet-sdk protocol
                            </Text>
                        </Flex>
                    </Flex>
                </Flex>
				</template>
			</Flex>
		</Flex>

		<Navigation />
	</Flex>
</template>

<style module>
.wrapper {
	flex: 1;
	overflow: auto;
	background: var(--app-bg);

	padding: 16px 24px 96px 24px;
}

.disconnect_all {
	margin-top: 4px;
	cursor: pointer;

	&:hover {
		fill: var(--red);
	}
}

.section_wrapper {
	flex: 1;

	min-height: 0;
}

.sessions_section {
	flex: 1;

	padding-bottom: 100px;
	overflow: auto;
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

.delete_icon {
	&:hover {
		fill: var(--red);
	}
}

.empty_section {
    flex: 1;

    margin-bottom: 50px;
}

.empty_banner {
	max-width: 250px;

	margin: 40px auto 0 auto;
}

</style>