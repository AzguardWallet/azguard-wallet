<route lang="json">
{
	"meta": {
		"isAuthRequired": true
	}
}
</route>

<script setup>
/** Utils */
import { Config } from "@/wallet/config"
import { ConfigServiceClient } from "@/wallet/services/config/client"
import { ProfileServiceClient } from "@/wallet/services/profile/client"
import { debounce } from "@/utils/general"

/** Composables */
import { useToast } from "@/composables/toast"
const { openToast } = useToast()

const configService = new ConfigServiceClient()
configService.onUpdate.add(onSettingUpdate)

const profileService = new ProfileServiceClient()
const isLoading = ref(true)

const defaultConfig = new Config()
const MAX_SESSION_TTL = 1440
const sessionTtl = ref(defaultConfig.sessionTtl)
const sessionTtlMinutes = ref(0)

const notification = reactive({
	show: false,
	text: "",
})
function fillNotification(text) {
	if (!text) {
		notification.show = false
		notification.text = ""
		return
	}

	notification.show = true
	notification.text = text
}

async function updateSessionTtl(value) {
	if (sessionTtl.value === value) return

	try {
		await configService.setValue("sessionTtl", value)
		sessionTtl.value = value
		await profileService.refreshSession()
		openToast({ label: "Auto-lock timeout updated", icon: "info" }, TOAST_DURATION.SHORT)
	} catch (err) {
		openToast({ label: "Failed to update setting", icon: "warning" }, TOAST_DURATION.LONG)
	}
}

function onSettingUpdate(setting) {
	if (setting.key === "sessionTtl" && sessionTtl.value !== setting.value) {
		sessionTtl.value = setting.value
		sessionTtlMinutes.value = String(setting.value / 1_000 / 60)
	}
}

watch(
	() => sessionTtlMinutes.value,
	debounce(() => {
		updateSessionTtl(Number(sessionTtlMinutes.value) * 60 * 1_000)
		switch (Number(sessionTtlMinutes.value)) {
			case 0:
				fillNotification("'0' means the wallet will never be locked automatically")
				break
			case MAX_SESSION_TTL:
				fillNotification("This is the maximum session time. Use 0 to disable auto-lock.")
				break

			default:
				fillNotification("")
				break
		}
	}, 300),
)

onBeforeMount(async () => {
	const ttl = await configService.getValue("sessionTtl")
	if (ttl !== undefined) sessionTtl.value = ttl
	sessionTtlMinutes.value = String(sessionTtl.value / 1_000 / 60)

	isLoading.value = false
})

onBeforeUnmount(() => {
	configService.disconnect()
	profileService.disconnect()
})
</script>

<template>
	<Flex direction="column" :class="$style.wrapper">
		<SubPageHeader title="Security" :backTo="'/popup/settings'" />

		<Flex direction="column" gap="32" :class="$style.content">
			<LoadingState v-if="isLoading" label="FETCHING SETTINGS" />

			<template v-if="!isLoading">
				<!-- Auto-lock Timeout -->
				<Flex justify="between" align="center">
					<Flex direction="column" gap="6">
						<Flex align="end" gap="6">
							<Text size="13" weight="600" color="primary">Auto-lock Timeout</Text>
							<Tooltip v-if="notification.show">
								<Icon name="info" color="secondary" size="14" />
								<template #content>
									<Flex align="center" :class="$style.tooltip">
										<Text size="12" color="secondary">{{ notification.text }}</Text>
									</Flex>
								</template>
							</Tooltip>
						</Flex>
						<Text size="12" weight="500" color="tertiary">Automatic wallet locking (minutes)</Text>
					</Flex>

					<Input
						v-model="sessionTtlMinutes"
						type="text"
						subtype="int"
						:max="MAX_SESSION_TTL"
						placeholder="30"
						:class="$style.input"
					/>
				</Flex>

				<!-- Backup -->
				<ItemsContainer>
					<SettingItem
						size="large"
						title="Backup profile"
						description="Get the seed phrase or secret key"
						icon="download"
						to="/popup/settings/security/export"
					/>
				</ItemsContainer>
			</template>
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

.tooltip {
	max-width: 200px;

	* {
		line-height: 1.2;
	}
}

.input {
	width: 60px;

	* {
		text-align: center;
	}
}
</style>
