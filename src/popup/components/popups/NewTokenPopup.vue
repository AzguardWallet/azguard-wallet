<script setup>
// import { AztecAddress } from "@aztec/aztec.js"
/** Components */
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"

/** Utils */
import { managers } from "@/utils/core"

/** Store */
import { useAppStore } from "@/stores/app.store"
import { usePopupStore } from "@/stores/popup.store"
const appStore = useAppStore()
const popupStore = usePopupStore()

const emit = defineEmits(["onClose"])

const contractAddressTerm = ref("")

const isAvailableToCreateToken = computed(() => {
	if (!contractAddressTerm.value.length) return

	return true
})

const handleCreateAccount = async () => {
	// const test = await managers.token.parseInterface(
	// 	"0x2cee972228c1ca2f802e2c94cf2e98e642a38d44d646e53dbee210333747d34f"
	// )
	console.log(await managers.network.getNetworks())

	if (!isAvailableToCreateToken.value) return

	emit("onClose")
}
</script>

<template>
	<Popup @onClose="emit('onClose')">
		<PopupCard>
			<Flex wide direction="column" gap="20" :class="$style.wrapper">
				<Text size="14" weight="600" color="primary"> Add token </Text>

				<Input
					v-model="contractAddressTerm"
					label="Contract address"
					placeholder="0x"
				/>

				<Button
					@click="handleCreateAccount"
					wide
					type="primary"
					size="medium"
					:disabled="!isAvailableToCreateToken"
				>
					<Text color="inverse">Create</Text>
				</Button>

				<Text
					size="12"
					weight="500"
					color="tertiary"
					height="140"
					align="center"
				>
					New accounts do not require the creation of a new seed
					phrase, just select the account type
				</Text>
			</Flex>
		</PopupCard>
	</Popup>
</template>

<style module>
.wrapper {
	padding: 0 20px 24px 20px;
}

.network {
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

.icons {
	opacity: 0;

	transition: all 0.2s var(--bezier);
}

.item {
	height: 30px;

	border-radius: 8px;
	box-shadow: inset 0 0 0 2px var(--gray-5);
	cursor: pointer;

	padding: 0 16px;

	transition: all 0.2s var(--bezier);

	&:hover {
		box-shadow: inset 0 0 0 2px var(--gray-10);
	}

	&:active {
		background: var(--gray-5);
	}

	&.selected {
		background: var(--green);
	}

	&.disabled {
		opacity: 0.5;
		pointer-events: none;
	}
}
</style>
