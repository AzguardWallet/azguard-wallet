<script setup>
/** Vendor */
import { generate } from "lean-qr"

/** Components */
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"

/** Composables */
import { useToast } from "@/composables/toast.js"
const { openToast } = useToast()

/** Store */
import { useAppStore } from "@/stores/app.store.ts"
import { usePopupStore } from "@/stores/popup.store.ts"
const appStore = useAppStore()
const popupStore = usePopupStore()

const emit = defineEmits(["onClose"])

const account = computed(() => appStore.account)

watch(
	() => popupStore.popups,
	() => {
		if (!popupStore.popups.includes("receive")) return

		nextTick(() => {
			const qrCode = generate(appStore.account.address)
			qrCode.toCanvas(document.getElementById("my-qr-code"))
		})
	},
	{
		deep: true,
	}
)

const handleCopyAddress = () => {
	window.navigator.clipboard.writeText(appStore.account.address)
	openToast({ label: "Address is copied to clipboard", icon: "copy" })
}
</script>

<template>
	<Popup @onClose="emit('onClose')">
		<PopupCard>
			<Flex wide direction="column" gap="24" :class="$style.wrapper">
				<Flex align="center" gap="6">
					<Icon
						name="arrow-bottom-circle"
						size="16"
						color="primary"
					/>
					<Text size="16" weight="600" color="primary">
						Receive
					</Text>
				</Flex>

				<Flex wide direction="column" align="center" gap="8">
					<canvas id="my-qr-code" :class="$style.qrcode" />

					<Flex align="center" justify="center" :class="$style.link">
						<Flex align="center" direction="column" gap="8">
							<Text size="14" weight="600" color="primary">
								{{ account.name }}
							</Text>

							<Flex
								@click="handleCopyAddress"
								align="center"
								gap="6"
								class="copyable"
							>
								<Text size="13" weight="600" color="body">
									{{ account.address.slice(0, 6) }}
									•••
									{{ account.address.slice(-4) }}
								</Text>

								<Icon name="copy" size="12" color="tertiary" />
							</Flex>
						</Flex>
					</Flex>
				</Flex>

				<Button
					@click="popupStore.close('receive')"
					type="secondary"
					size="medium"
				>
					Close
				</Button>
			</Flex>
		</PopupCard>
	</Popup>
</template>

<style module>
.wrapper {
	padding: 0 20px 24px 20px;
}

.link {
	padding: 12px 16px 12px 12px;
}

.qrcode {
	width: 100%;
	image-rendering: pixelated;

	user-select: none;
	-webkit-user-drag: none;
	box-shadow: inset 0 0 0 1px var(--op-10);
	border-radius: 12px;
}

[theme="dark"] {
	.qrcode {
		filter: invert(1);
	}
}
</style>
