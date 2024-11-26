<script setup>
/** Components */
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"

const emit = defineEmits(["onClose"])
</script>

<template>
	<Popup @onClose="emit('onClose')">
		<PopupCard>
			<Flex wide direction="column" gap="24" :class="$style.wrapper">
				<Flex direction="column" gap="12">
					<Text size="14" weight="600" color="primary">
						Select token
					</Text>

					<Flex direction="column" gap="8">
						<Flex
							align="center"
							justify="between"
							:class="$style.token"
						>
							<Flex align="center" gap="8">
								<Icon name="aztec" size="16" color="green" />
								<Text size="14" weight="600" color="primary">
									AZT
								</Text>
								<Text size="14" weight="600" color="tertiary">
									Aztec Network
								</Text>
							</Flex>

							<Flex align="center" gap="8">
								<Text size="14" weight="600" color="primary">
									762 AZT
								</Text>
								<Icon
									name="chevron"
									size="16"
									color="tertiary"
									style="transform: rotate(-90deg)"
								/>
							</Flex>
						</Flex>

						<Text
							size="12"
							weight="600"
							color="tertiary"
							height="140"
							align="center"
						>
							Hidden <Text color="body">5 tokens</Text> with
							<Text color="body">zero</Text> private balance
						</Text>
					</Flex>
				</Flex>

				<Flex direction="column" gap="12">
					<Button type="secondary" size="medium">
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
