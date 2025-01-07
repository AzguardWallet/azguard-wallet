<script setup>
/** Store */
import { usePopupStore } from "@/stores/popup.store"
const popupStore = usePopupStore()

const props = defineProps({
	token: {
		type: Object,
	},
})

const isTokenRestricted = computed(() => {
	if (!props.token) return
	return !props.token.hasPrivateTransfers || !props.token.hasPublicTransfers
})
const isTokenBlocked = computed(() => {
	return !props.token.hasPrivateTransfers && !props.token.hasPublicTransfers
})

const handleSelectToken = () => {
	if (!props.token) {
		popupStore.open("new_token")
	} else {
		popupStore.open("select_token")
	}
}
</script>

<template>
	<Flex @click="handleSelectToken" align="center" justify="between" :class="$style.wrapper">
		<template v-if="token">
			<Flex align="center" gap="8">
				<Tooltip :disabled="!isTokenRestricted || !isTokenBlocked" position="start">
					<Flex align="center" justify="center" :class="$style.token_icon">
						<Icon name="banknote" size="16" color="primary" />
						<Icon v-if="isTokenBlocked" name="warning" size="10" color="red" :class="$style.type_icon" />
						<Icon
							v-else-if="isTokenRestricted"
							:name="!token.hasPrivateTransfers ? 'face' : 'key-square'"
							size="10"
							:color="!token.hasPrivateTransfers ? 'orange' : 'green'"
							:class="$style.type_icon"
						/>
					</Flex>

					<template #content>
						<template v-if="isTokenBlocked"> Private and public transfers disabled </template>
						<template v-else>
							Restricted token, only
							{{ token.hasPrivateTransfers ? "private" : "public" }}
							transfers
						</template>
					</template>
				</Tooltip>

				<Text size="13" weight="600" color="primary">
					{{ token.symbol }}
				</Text>
				<Text size="13" weight="600" color="body">
					{{ token.name }}
				</Text>
			</Flex>

			<Icon name="chevron" size="16" color="primary" style="transform: rotate(-90deg)" />
		</template>

		<Flex v-else wide align="center" justify="between">
			<Flex align="center" gap="8">
				<Icon name="info" size="16" color="orange" />
				<Text size="13" weight="600" color="secondary"> No available tokens </Text>
			</Flex>

			<Text size="13" weight="600" color="blue"> Import token </Text>
		</Flex>
	</Flex>
</template>

<style module>
.wrapper {
	width: 100%;

	background: var(--card-bg);
	box-shadow: inset 0 0 0 1px var(--gray-10), 0 1px 2px var(--shadow-5);
	border-radius: 12px;
	cursor: pointer;

	padding: 12px;

	transition: all 0.2s var(--bezier);

	&:hover {
		background: var(--gray-5);
	}
}

.token_icon {
	position: relative;
}

.type_icon {
	position: absolute;
	top: -5px;
	right: -5px;

	box-sizing: content-box;
	background: var(--card-bg);
	border-radius: 3px;

	padding: 1px;
}
</style>
