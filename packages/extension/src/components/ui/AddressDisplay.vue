<script setup>
/** Utils */
import { onMounted } from "vue"
import { managers } from "@/utils/core.js"
import { trimAddress } from "@/utils/string"

/** Store */
import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()

const emit = defineEmits(["onAddressClick"])
const props = defineProps({
	address: {
		type: String,
		required: false,
	},
	full: {
		type: Boolean,
		default: false,
	},
	formatter: {
		type: Function,
		default: null,
	},
	size: {
		type: String,
		default: "12",
	},
	weight: {
		type: String,
		default: "500",
	},
	height: {
		type: String,
		default: "100",
	},
	color: {
		type: String,
		default: "primary",
	},
	static: {
		type: Boolean,
		default: false,
	},
})

const contactName = ref("")
const displayedAddress = ref("")

const showName = ref(false)

const handleClick = () => {
	if (props.static) {
		emit("onAddressClick")
		return
	}

	showName.value = !showName.value

	if (contactName.value) {
		event.stopPropagation()
	}

	emit("onAddressClick")
}

onMounted(async () => {
	if (props.address) {
		const contact = await managers.contact.getContactByAddress(props.address)
		if (contact?.name) {
			contactName.value = `@${contact.name}`
			showName.value = true
		} else {
			const _acc = appStore.accounts.find((acc) => acc.address === props.address)
			if (_acc?.name) {
				contactName.value = _acc.name
				showName.value = true
			}
		}

		if (props.full) {
			displayedAddress.value = props.address
		} else {
			if (typeof props.formatter === "function") {
				displayedAddress.value = props.formatter(props.address)
			} else {
				displayedAddress.value = trimAddress(props.address)
			}
		}
	}
})
</script>

<template>
	<Text
		@click="handleClick"
		:size="size"
		:color="color"
		:weight="weight"
		:height="height"
		:class="contactName && $style.clickable"
	>
		{{ showName && contactName ? contactName : displayedAddress }}
	</Text>
</template>

<style module>
.clickable {
	cursor: pointer;
}
</style>
