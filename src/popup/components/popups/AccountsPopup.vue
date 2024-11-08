<script setup>
/** Components */
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"

/** Utils */
import { managers } from "@/utils/core"

/** Popup */
import { useAppStore } from "@/stores/app.store.ts"
import { usePopupStore } from "@/stores/popup.store.ts"
const appStore = useAppStore()
const popupStore = usePopupStore()

const emit = defineEmits(["onClose"])

const account = computed(() => appStore.account)
const otherAccounts = computed(() =>
	appStore.accounts.filter((a) => a.id !== account.value.id)
)
const address = computed(() => appStore.account.address.toString())

const handleSelectAccount = (acc) => {
	appStore.selectAccount(acc)
}
const handleDeleteAccount = (acc) => {
	appStore.deleteAccount(acc)
}
</script>

<template>
	<Popup @onClose="emit('onClose')">
		<PopupCard>
			<Flex wide direction="column" gap="20" :class="$style.wrapper">
				<Text size="14" weight="600" color="primary"> Accounts </Text>

				<Flex align="center" justify="between" :class="$style.account">
					<Flex gap="10">
						<Icon name="check-circle" size="16" color="green" />

						<Flex direction="column" gap="8">
							<Text size="14" weight="600" color="primary">
								{{ account.name }}
							</Text>
							<Text size="13" weight="600" color="tertiary">
								$0.00
								<Text color="support">•</Text>
								{{ address.slice(0, 6) }}...{{
									address.slice(-4)
								}}
							</Text>
						</Flex>
					</Flex>

					<Flex align="center" gap="8" :class="$style.icons">
						<Icon name="copy" size="14" color="tertiary" />
					</Flex>
				</Flex>

				<Flex v-if="otherAccounts.length" direction="column" gap="6">
					<Text size="12" weight="600" color="tertiary">
						Switch to
					</Text>

					<Flex
						v-for="acc in otherAccounts"
						@click="handleSelectAccount(acc)"
						align="center"
						justify="between"
						:class="$style.account"
					>
						<Flex gap="10">
							<Icon name="vault" size="16" color="blue" />

							<Text size="14" weight="600" color="primary">
								{{ acc.name }}
							</Text>
						</Flex>

						<Flex align="center" gap="8" :class="$style.icons">
							<Icon
								@click.stop="handleDeleteAccount(acc)"
								name="close-circle"
								size="14"
								color="tertiary"
							/>
						</Flex>
					</Flex>
				</Flex>

				<Button
					@click="popupStore.open('new_account')"
					wide
					type="secondary"
					size="medium"
					leftIcon="plus-circle"
					leftIconColor="blue"
				>
					New account
				</Button>

				<Text size="12" weight="500" color="tertiary" height="140">
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

.account {
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
</style>
