<script setup>
/** Components */
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"

/** Utils */
import { managers } from "@/utils/core.js"

/** Store */
import { useAppStore } from "@/stores/app.store.ts"
const appStore = useAppStore()

const router = useRouter()

const emit = defineEmits(["onClose"])

const handleLockWallet = () => {
	emit("onClose")
	appStore.isLogined = false
	router.push("/popup/auth")
	managers.profile.lock()
}
</script>

<template>
	<Popup @onClose="emit('onClose')">
		<PopupCard>
			<Flex wide direction="column" gap="24" :class="$style.wrapper">
				<Flex direction="column" gap="12">
					<Text size="14" weight="600" color="primary">
						Profiles
					</Text>

					<Flex align="center" justify="between" :class="$style.link">
						<Flex align="center" gap="10">
							<Icon name="check-circle" size="16" color="green" />
							<Text size="14" weight="600" color="primary">
								My Profile
							</Text>
						</Flex>

						<Flex align="center" gap="8" :class="$style.icons">
							<Icon name="settings" size="16" color="tertiary" />
						</Flex>
					</Flex>
				</Flex>

				<Flex direction="column" gap="8">
					<Text size="13" weight="600" color="body"> Settings </Text>

					<RouterLink to="/popup/settings/general">
						<Flex
							@click="emit('onClose')"
							align="center"
							justify="between"
							:class="$style.link"
						>
							<Flex gap="10">
								<Icon
									name="settings"
									size="16"
									color="secondary"
								/>

								<Flex direction="column" gap="6">
									<Text
										size="14"
										weight="600"
										color="primary"
									>
										General
									</Text>
									<Text size="13" weight="500" color="body">
										Select theme, set up notifications
									</Text>
								</Flex>
							</Flex>

							<Icon
								name="chevron"
								size="14"
								color="tertiary"
								style="transform: rotate(-90deg)"
							/>
						</Flex>
					</RouterLink>

					<RouterLink to="/popup/settings/security">
						<Flex
							@click="emit('onClose')"
							align="center"
							justify="between"
							:class="$style.link"
						>
							<Flex gap="10">
								<Icon
									name="key-square"
									size="16"
									color="secondary"
								/>

								<Flex direction="column" gap="6">
									<Text
										size="14"
										weight="600"
										color="primary"
									>
										Security
									</Text>
									<Text size="13" weight="500" color="body">
										Password and account managemenet
									</Text>
								</Flex>
							</Flex>

							<Icon
								name="chevron"
								size="14"
								color="tertiary"
								style="transform: rotate(-90deg)"
							/>
						</Flex>
					</RouterLink>

					<RouterLink to="/popup/settings/developer">
						<Flex
							@click="emit('onClose')"
							align="center"
							justify="between"
							:class="$style.link"
						>
							<Flex gap="10">
								<Icon
									name="terminal-square"
									size="16"
									color="secondary"
								/>

								<Flex direction="column" gap="6">
									<Text
										size="14"
										weight="600"
										color="primary"
									>
										Developer
									</Text>
									<Text size="13" weight="500" color="body">
										Modify networks, endpoints, etc
									</Text>
								</Flex>
							</Flex>

							<Icon
								name="chevron"
								size="14"
								color="tertiary"
								style="transform: rotate(-90deg)"
							/>
						</Flex>
					</RouterLink>
				</Flex>

				<Flex direction="column" gap="12">
					<Or />
					<Button
						@click="handleLockWallet"
						type="secondary"
						size="medium"
					>
						<Icon name="lock" size="12" color="tertiary" />
						Lock Wallet
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

.link {
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
