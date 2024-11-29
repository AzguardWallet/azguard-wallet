<script setup>
/** Components */
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"

/** Store */
import { useAppStore } from "@/stores/app.store"
import { usePopupStore } from "@/stores/popup.store"
import { useCacheStore } from "@/stores/cache.store"
const appStore = useAppStore()
const popupStore = usePopupStore()
const cacheStore = useCacheStore()

const emit = defineEmits(["onClose"])
const props = defineProps({
	show: Boolean,
})

const handleSelectToken = (target) => {
	cacheStore.activeTokenIdx = target.id
	emit("onClose")
}
</script>

<template>
	<Popup :show @onClose="emit('onClose')">
		<PopupCard>
			<Flex wide direction="column" gap="24" :class="$style.wrapper">
				<Flex direction="column" gap="12">
					<Text size="14" weight="600" color="primary">
						Select token
					</Text>

					<Flex direction="column" gap="8">
						<Flex
							v-for="token in appStore.tokens"
							@click="handleSelectToken(token)"
							align="center"
							justify="between"
							:class="$style.token"
						>
							<Flex align="center" gap="8">
								<Icon
									name="banknote"
									size="16"
									color="primary"
								/>
								<Text size="14" weight="600" color="primary">
									{{ token.symbol }}
								</Text>
								<Text size="14" weight="600" color="tertiary">
									{{ token.name }}
								</Text>
							</Flex>

							<Flex align="center" gap="8">
								<Icon
									name="chevron"
									size="16"
									color="tertiary"
									style="transform: rotate(-90deg)"
								/>
							</Flex>
						</Flex>
					</Flex>
				</Flex>

				<Flex direction="column" gap="12">
					<Button
						@click="popupStore.open('tokens')"
						type="secondary"
						size="medium"
					>
						Manage tokens
					</Button>
				</Flex>
			</Flex>
		</PopupCard>
	</Popup>
</template>

<style module>
.wrapper {
	padding: 0 20px 24px 20px;
}

.token {
	border-radius: 12px;
	cursor: pointer;
	box-shadow: inset 0 0 0 1px var(--border), 0 1px 2px var(--shadow-5);

	padding: 12px 16px 12px 12px;

	transition: all 0.2s var(--bezier);

	&:hover {
		background: var(--gray-3);
		box-shadow: inset 0 0 0 1px var(--border-hovered),
			0 1px 2px var(--shadow-5);
	}

	&:active {
		background: var(--gray-5);
	}
}
</style>
