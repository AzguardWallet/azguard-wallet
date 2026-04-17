<script setup>
/** Vendor */
import { generate } from "lean-qr"

/** Composables */
import { useToast } from "@/composables/toast.js"
const { openToast } = useToast()

/** Store */
import { useAppStore } from "@/stores/app.store.ts"
import { usePopupStore } from "@/stores/popup.store.ts"
const appStore = useAppStore()
const popupStore = usePopupStore()

const emit = defineEmits(["onClose"])
const props = defineProps({
	show: Boolean,
})

const displaceIdx = computed(() => {
	return popupStore.len - popupStore.popups.receive?.order
})

const account = computed(() => appStore.account)

const handleCopyAddress = () => {
	window.navigator.clipboard.writeText(appStore.account.address)
	openToast({ label: "Address is copied", icon: "copy" })
}

watch(
	() => props.show,
	() => {
		if (!props.show) return

		nextTick(() => {
			const qrCode = generate(appStore.account.address)
			qrCode.toCanvas(document.getElementById("my-qr-code"))
		})
	},
)
</script>

<template>
	<Popup :show="show" @onClose="emit('onClose')" :displaceIdx="popupStore.popups.receive?.order">
		<PopupCard :displaceIdx>
			<Flex wide align="center" direction="column" gap="24" :class="$style.wrapper">
				<Flex align="center" gap="6">
					<Icon name="arrow-bottom-circle" size="16" color="primary" />
					<Text size="16" weight="600" color="primary"> Receive </Text>
				</Flex>

				<Flex wide direction="column" align="center" gap="8">
					<canvas id="my-qr-code" :class="$style.qrcode" />

					<Flex align="center" justify="center" :class="$style.link">
						<Flex align="center" direction="column" gap="8">
							<Text size="14" weight="600" color="primary">
								{{ account.name }}
							</Text>

							<Flex @click="handleCopyAddress" align="center" gap="6" class="copyable" data-testid="receive-address">
								<Text size="13" weight="600" color="body">
									{{ account.address.slice(0, 6) }}
									<Text color="dark">•••</Text>
									{{ account.address.slice(-4) }}
								</Text>

								<Icon name="copy" size="12" color="tertiary" />
							</Flex>
						</Flex>
					</Flex>
				</Flex>

				<Button @click="popupStore.close('receive')" wide type="secondary" size="medium"> Close </Button>
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
	border: 1px solid var(--nulo-border);
	border-radius: 0;
}

[theme="dark"] {
	.qrcode {
		filter: invert(1);
	}
}
</style>
