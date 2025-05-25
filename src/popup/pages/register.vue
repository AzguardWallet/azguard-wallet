<route lang="json">
{
	"meta": {
		"isAuthRequired": false
	}
}
</route>

<script setup>
/** Components */
import RegisterPopup from "../components/popups/RegisterPopup/RegisterPopup.vue"

/** Composabled */
import { useSettings } from "@/composables/settings.js"
const { settings, updateSettings } = useSettings()

/** Store */
import { useAppStore } from "@/stores/app.store"
import { useCacheStore } from "@/stores/cache.store"
import { usePopupStore } from "@/stores/popup.store"
const appStore = useAppStore()
const cacheStore = useCacheStore()
const popupStore = usePopupStore()

const theme = computed(() => settings.value.appearance?.theme)

const handleOpen = target => {
	chrome.windows.create({
		type: "popup",
		url: `https://azguardwallet.io/${target}`,
		width: 360,
		height: 600,
	})
}

const handleImport = () => {
	cacheStore.importType = "default"
	popupStore.open("import")
}
</script>

<template>
	<Flex wide direction="column" align="center" justify="between" :class="$style.wrapper">
		<Flex direction="column" align="center" gap="16">
			<Text size="32" weight="500" align="center" :class="$style.title"> Privacy of finances is paramount </Text>
			<Text size="14" weight="500" color="body" height="140" align="center" :class="$style.description">
				Get power of privacy on Ethereum with Aztec Blockchain
			</Text>

			<Button type="secondary" size="mini" disabled>
				<Icon name="warning" size="16" color="orange" />
				Azguard Alpha Testing
			</Button>
		</Flex>

		<Flex direction="column" gap="16" align="center" :class="$style.bottom">
			<Flex wide direction="column" gap="8">
				<Button @click="appStore.showRegisterPopup = true" size="medium" type="primary" wide>
					<Flex align="center" gap="6">
						<Text size="13">Create Profile</Text>
						<Icon name="arrow-circle-broken-right" size="16" />
					</Flex>
				</Button>
				<Button @click="popupStore.open('import')" size="medium" type="secondary" wide> Import Profile </Button>
			</Flex>

			<Text size="11" weight="500" color="tertiary" height="140" align="center">
				By continuing, you are confirming that you read and agree to

				<Text @click="handleOpen('terms')" color="secondary" :class="$style.link"> Terms of Use </Text>
				and
				<Text @click="handleOpen('privacy')" color="secondary" :class="$style.link"> Privacy Policy </Text>
			</Text>

			<Flex align="center" gap="4" :class="$style.theme_switcher">
				<Icon
					@click="updateSettings('appearance', 'theme', 'light')"
					name="sun"
					size="14"
					color="tertiary"
					:class="theme === 'light' && $style.active"
				/>
				<Icon
					@click="updateSettings('appearance', 'theme', 'dark')"
					name="moon"
					size="14"
					color="tertiary"
					:class="theme === 'dark' && $style.active"
				/>
				<Icon
					@click="updateSettings('appearance', 'theme', 'system')"
					name="settings"
					size="14"
					color="tertiary"
					:class="theme === 'system' && $style.active"
				/>
			</Flex>
		</Flex>

		<Transition name="slide">
			<RegisterPopup v-if="appStore.showRegisterPopup" />
		</Transition>
	</Flex>
</template>

<style module>
.wrapper {
	position: relative;
	overflow: hidden;

	height: 100%;

	padding-top: 170px;
	margin: 0 auto;
}

.title {
	max-width: 300px;

	font-family: "Clash Display";

	background-image: linear-gradient(var(--txt-primary), var(--txt-secondary));
	background-clip: text;
	background-size: 100%;
	-webkit-text-fill-color: transparent;
}

.description {
	max-width: 240px;
}

.bottom {
	max-width: 260px;

	margin-bottom: 24px;

	transition: all 0.5s var(--bezier);
}

.link {
	cursor: pointer;

	&:hover {
		color: var(--txt-primary);
	}
}

.theme_switcher {
	background: var(--gray-10);
	border-radius: 50px;

	& svg {
		box-sizing: content-box;
		border-radius: 50%;
		cursor: pointer;

		padding: 2px;

		&.active {
			fill: var(--txt-primary);
		}
	}

	padding: 4px;
}
</style>
