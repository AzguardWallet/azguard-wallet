<script setup>


/** Store */
import { useCacheStore } from "@/stores/cache.store"
import { usePopupStore } from "@/stores/popup.store"
const cacheStore = useCacheStore()
const popupStore = usePopupStore()

const displaceIdx = computed(() => {
	return popupStore.len - popupStore.popups.forgot_password?.order
})

const emit = defineEmits(["onClose"])
const props = defineProps({
	show: Boolean,
})

const handleImport = () => {
	cacheStore.importType = "recovery"
	popupStore.open("import")
}
</script>

<template>
	<Popup :show @onClose="emit('onClose')" :displaceIdx="popupStore.popups.forgot_password?.order">
		<PopupCard :displaceIdx>
			<Flex wide direction="column" gap="32" :class="$style.wrapper">
				<Flex align="center" direction="column" gap="12">
					<Flex align="center" gap="6">
						<Icon name="help" size="18" color="primary" />
						<Text size="16" weight="600" color="primary"> Authorization Issues </Text>
					</Flex>

					<Text size="14" weight="500" color="body" height="140" align="center" style="padding: 0 12px">
						If the password is lost, reset the profile. For other auth problems, contact us.
					</Text>
				</Flex>

				<ItemsContainer title="Reset Profile">
					<SettingItem
						@click="popupStore.open('reset')"
						title="Reset Profile"
						icon="trash"
						iconBgColor="red"
						chevron
					/>
					<!-- <SettingItem
						title="Profile Recovery"
						description="Currently Unavailable"
						icon="restart"
						iconBgColor="blue"
						chevron
						disabled
					/> -->
				</ItemsContainer>

				<ItemsContainer
					description="Requests to reset or recover your password will be ignored, use the recovery methods listed above"
				>
					<SettingItem
						title="Report issue with authorization"
						to="https://azguardwallet.io/forms/report-issue"
						icon="help"
						external
					/>
				</ItemsContainer>
			</Flex>
		</PopupCard>
	</Popup>
</template>

<style module>
.wrapper {
	padding: 0 20px 24px 20px;
}
</style>
