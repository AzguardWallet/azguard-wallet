<script setup>
/** Components */
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"

/** Utils */
import { managers } from "@/utils/core"

/** Store */
import { usePopupStore } from "@/stores/popup.store"
const popupStore = usePopupStore()

const emit = defineEmits(["onClose"])

const uri = ref("")
const isLoading = ref(false)
const connectionError = ref({
	show: false,
	title: "",
})

const handleConnectByURI = async () => {
	connectionError.value.show = false

	try {
		isLoading.value = true
		await managers.wallectConnect.connectByURI(uri.value)
		
		closePopup()
	} catch (error) {
		isLoading.value = false
		if (error.includes("Missing or invalid. pair() uri")) {
			connectionError.value = {
				show: true,
				title: 'Invalid connection URI.',
			}
		} else if (error.includes("Pairing already exists")) {
			connectionError.value = {
				show: true,
				title: 'Pairing already exists, please try again with new URI.',
			}
		} else {
			connectionError.value = {
				show: true,
				title: 'Unexpected connection error, please try again.',
			}
		}
	}
}

const closePopup = () => {
	isLoading.value = false
	connectionError.value.show = false
	uri.value = ""

	emit('onClose')
}

watch(
	() => uri.value,
	() => {
		connectionError.value.show = false
	}
)

const onKeydown = (e) => {
	if (e.code === "Enter" && uri.value) handleConnectByURI()
}

onMounted(() => {
	document.addEventListener("keydown", onKeydown)
})
</script>

<template>
	<Popup @onClose="closePopup" :displaceIdx=popupStore.popups.connect_by_uri>
		<PopupCard>
			<Flex wide direction="column" gap="12" :class="$style.wrapper">
				<Text size="13" weight="500" color="primary"> Connect by URI </Text>

				<Flex direction="column" gap="4">
					<Input
						v-model="uri"
						placeholder="wc:a377a2acb5653eacb0abea97a53e0517a2d.."
						size="small"
						autofocus
						:style="{flex: 1}"
					/>

					<Text v-if="connectionError.show" size="12" weight="600" color="red" :style="{paddingLeft: '4px'}">
						{{ connectionError.title }}
					</Text>
				</Flex>

				<Button
					@click="handleConnectByURI()"
					wide
					type="secondary"
					size="medium"
					leftIcon="arrow-right-circle"
					leftIconColor="blue"
					:loading="isLoading"
					:disabled="!uri"
					:class="connectionError.show && $style.shake"
				>
					Connect
				</Button>
			</Flex>
		</PopupCard>
	</Popup>
</template>

<style module>
.wrapper {
	padding: 0 20px 24px 20px;
}

.shake {
	animation: shake 0.5s ease;
}

@keyframes shake {
	0%, 100% {
		transform: translateX(0);
	}
	25% {
		transform: translateX(-5px);
	}
	50% {
		transform: translateX(5px);
	}
	75% {
		transform: translateX(-5px);
	}
}
</style>
