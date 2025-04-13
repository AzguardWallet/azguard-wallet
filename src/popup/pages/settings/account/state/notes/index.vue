<route lang="json">
{
	"meta": {
		"title": "Notes",
		"isAuthRequired": true
	}
}
</route>

<script setup>
/** Components */
import Navigation from "../../../../../components/Navigation.vue"
import Breadcrumbs from "@/components/ui/Settings/Breadcrumbs.vue"
import ItemsContainer from "@/components/ui/Settings/ItemsContainer.vue"
import SettingItem from "@/components/ui/Settings/SettingItem.vue"

/** Utils */
import { managers } from "@/utils/core.js"

/** Composables */
import { useToast } from "@/composables/toast.js"
const { openToast } = useToast()

/** Store */
import { useAppStore } from "@/stores/app.store"
import { usePopupStore } from "@/stores/popup.store"
import { useCacheStore } from "@/stores/cache.store"
const appStore = useAppStore()
const popupStore = usePopupStore()
const cacheStore = useCacheStore()

const notes = ref([])
const isFetchingNotes = ref(false)
const error = ref()
const isErrorOccurred = computed(() => !!error.value)
const fetchNotes = async isRefetching => {
	if (isRefetching) openToast({ label: "Fetching notes again", icon: "zap" })
	isFetchingNotes.value = true

	try {
		notes.value = await managers.accountState.getNotes(appStore.network.id, appStore.account.address)
	} catch (err) {
		error.value = err

		isFetchingNotes.value = false
	} finally {
		isFetchingNotes.value = false
	}
}

const handleOpenNotePopup = note => {
	cacheStore.activeNote = note
	popupStore.open("note")
}

onMounted(async () => {
	if (appStore.network && appStore.isLogined) fetchNotes()
})

watch(
	() => appStore.account,
	() => {
		fetchNotes()
	},
)
</script>

<template>
	<Flex v-if="appStore.isLogined" direction="column" gap="20" :class="$style.wrapper">
		<Breadcrumbs />

		<Flex direction="column" gap="16">
			<Banner v-if="isFetchingNotes" isLoading> Fetching notes </Banner>

			<Tooltip v-else-if="isErrorOccurred" wide>
				<Banner :action="{ name: 'Try again', callback: () => fetchNotes(true) }" variant="error" wide>
					Something went wrong
				</Banner>

				<template #content>
					{{ error }}
				</template>
			</Tooltip>

			<Flex v-else-if="notes.length" direction="column" gap="8">
				<Flex v-for="note in notes" @click="handleOpenNotePopup(note)" justify="between" :class="$style.card">
					<Flex gap="10">
						<Icon name="zap" size="16" color="tertiary" />

						<Flex direction="column" gap="8">
							<Text size="14" weight="600" color="primary"> Note </Text>
							<Text size="13" weight="600" color="tertiary"> Contract - {{ note.contractAddress.substring(0, 10) }}..{{ note.contractAddress.substring(60) }} </Text>
						</Flex>
					</Flex>

					<Icon name="arrow-narrow-up-right" size="12" color="tertiary" />
				</Flex>
			</Flex>

			<Banner v-else> So far, it's empty </Banner>
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

	padding: 12px;

	transition: all 0.2s var(--bezier);

	&:hover {
		background: var(--gray-3);
		box-shadow: inset 0 0 0 1px var(--border-hovered), 0 1px 2px var(--shadow-10);

		& .icons {
			opacity: 1;
		}
	}

	&:active {
		background: var(--gray-5);
	}
}
</style>
