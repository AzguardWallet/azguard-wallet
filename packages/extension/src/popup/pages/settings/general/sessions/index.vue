<route lang="json">
{
	"meta": {
		"isAuthRequired": true
	}
}
</route>

<script setup>
/** Components */
import { Dropdown } from "@/components/ui/Dropdown"

/** Services */
import { DappSessionServiceClient } from "@/wallet/services/dapp-session/client"

/** Store */
import { useCacheStore } from "@/stores/cache.store"
import { usePopupStore } from "@/stores/popup.store"
const cacheStore = useCacheStore()
const popupStore = usePopupStore()

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

const sortedSessions = computed(() => [...dappSessions.value].sort((a, b) => a.expiry - b.expiry))

const dappSessionService = new DappSessionServiceClient()
dappSessionService.onDappSessionAdded.add(onDappSessionAdded)
dappSessionService.onDappSessionUpdated.add(onDappSessionUpdated)
dappSessionService.onDappSessionDeleted.add(onDappSessionDeleted)

async function hydrateLogo(session) {
	if (!session.dappMetadata?.logo || session.dappMetadata.logoBlobUrl) return
	session.loadingLogo = true
	try {
		session.dappMetadata.logoBlobUrl = await loadExternalImage(session.dappMetadata.logo)
	} finally {
		session.loadingLogo = false
	}
}

function onDappSessionAdded(session) {
	dappSessions.value.push(session)
	hydrateLogo(session)
}
function onDappSessionUpdated(session) {
	const idx = dappSessions.value.findIndex((ds) => ds.id === session.id)
	if (idx !== -1) {
		// Preserve already-loaded logoBlobUrl across updates
		const prevBlob = dappSessions.value[idx].dappMetadata?.logoBlobUrl
		dappSessions.value[idx] = session
		if (prevBlob && session.dappMetadata) {
			session.dappMetadata.logoBlobUrl = prevBlob
		}
	} else {
		dappSessions.value.push(session)
	}
	hydrateLogo(session)
}
function onDappSessionDeleted(session) {
	dappSessions.value = dappSessions.value.filter((ds) => ds.id !== session.id)
}

const handleOpenSession = (session) => {
	router.push(`/popup/settings/general/sessions/session/${session.id}`)
}

const handleDropSession = (session) => {
	cacheStore.confirm.confirm_color = "red"
	cacheStore.confirm.confirm_text = "Yes, disconnect"
	cacheStore.confirm.description = `Disconnect "${session.dappMetadata?.name ?? "this dApp"}"?`
	cacheStore.confirm.callback = async () => {
		await dappSessionService.deleteDappSession(session.id)
	}
	popupStore.open("confirm")
}

const handleDropAllSessions = () => {
	if (!dappSessions.value.length) return
	cacheStore.confirm.confirm_color = "red"
	cacheStore.confirm.confirm_text = "Yes, disconnect all"
	cacheStore.confirm.description = `Disconnect all ${dappSessions.value.length} sessions?`
	cacheStore.confirm.callback = async () => {
		for (const session of [...dappSessions.value]) {
			await dappSessionService.deleteDappSession(session.id)
		}
	}
	popupStore.open("confirm")
}

onBeforeMount(async () => {
	const sessions = await dappSessionService.getDappSessions()
	dappSessions.value = sessions
	for (const session of sessions) hydrateLogo(session)
})

onBeforeUnmount(() => {
	dappSessionService.disconnect()
})
</script>

<template>
	<Flex direction="column" :class="$style.wrapper">
		<SubPageHeader title="Sessions" leadingIcon="extension" :backTo="'/popup/settings/general'">
			<template #trailing>
				<Dropdown>
					<button type="button" :class="$style.icon_btn" aria-label="Session actions">
						<MaterialIcon name="more_vert" :size="18" color="secondary" />
					</button>

					<template #popup>
						<DropdownItem @click="handleDropAllSessions" :disabled="!dappSessions.length">
							<Flex align="center" gap="8">
								<Icon name="log-out" size="14" color="secondary" />
								Disconnect all sessions
							</Flex>
						</DropdownItem>
					</template>
				</Dropdown>
			</template>
		</SubPageHeader>

		<Flex direction="column" gap="16" :class="$style.content">
			<Text size="13" weight="600" color="primary">
				Sessions&nbsp;<Text color="tertiary">{{ sortedSessions.length }}</Text>
			</Text>

			<ItemsContainer v-if="sortedSessions.length">
				<SettingItem
					v-for="ds in sortedSessions"
					:key="ds.id"
					@click="handleOpenSession(ds)"
					:title="ds.dappMetadata.name"
					:description="formatGrantSummary(ds.capabilityGrants ?? [])"
				>
					<template #icon>
						<Icon v-if="ds.loadingLogo" :loading="true" name="dapp" size="18" color="tertiary" />
						<img
							v-else-if="ds.dappMetadata.logoBlobUrl"
							:src="ds.dappMetadata.logoBlobUrl"
							:class="$style.logo"
							alt=""
						/>
						<Icon v-else name="dapp" size="18" color="tertiary" />
					</template>

					<template #right>
						<Tooltip position="end" delay="350">
							<div data-testid="session-disconnect" @click.stop="handleDropSession(ds)" :class="$style.action_wrapper">
								<Icon name="close-circle" size="14" color="tertiary" :class="$style.delete_icon" />
							</div>

							<template #content> Disconnect session </template>
						</Tooltip>
					</template>
				</SettingItem>
			</ItemsContainer>

			<Banner v-else>No active sessions</Banner>
		</Flex>

	</Flex>
</template>

<style module>
.wrapper {
	flex: 1;
	overflow: auto;
	scrollbar-gutter: stable;
	background: var(--app-bg);
}

.content {
	padding: 16px 24px var(--nav-clearance) 24px;
}

.logo {
	width: 20px;
	height: 20px;
	object-fit: cover;
	flex-shrink: 0;
}

.icon_btn {
	display: flex;
	align-items: center;
	justify-content: center;

	width: 32px;
	height: 32px;

	background: transparent;
	border: none;
	cursor: pointer;

	transition: background 0.2s var(--bezier);

	&:hover {
		background: rgba(248, 241, 231, 0.08);
	}
}

.action_wrapper {
	display: inline-flex;
	cursor: pointer;
}

.delete_icon {
	cursor: pointer;
	transition: all 0.2s var(--bezier);

	&:hover {
		fill: var(--red);
	}
}
</style>
