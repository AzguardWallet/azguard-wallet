<script setup>
/** Store */
import { useAppStore } from "@/stores/app.store"
import { usePopupStore } from "@/stores/popup.store"
const appStore = useAppStore()
const popupStore = usePopupStore()

const handleOpenPopup = (target) => {
	if (!appStore.isLogined) return
	popupStore.open(target)
}
</script>

<template>
	<Flex
		v-if="!appStore._isHomeScreenOpened"
		align="center"
		justify="between"
		:class="$style.wrapper"
	>
		<Flex
			@click="handleOpenPopup('menu')"
			align="center"
			justify="center"
			:class="[$style.button, !appStore.isLogined && $style.disabled]"
		>
			<Icon name="dots" size="18" color="primary" />
		</Flex>

		<Flex align="center" gap="8">
			<Flex
				v-if="appStore.isLogined"
				@click="handleOpenPopup('accounts')"
				align="center"
				gap="6"
				:class="$style.account"
			>
				<Transition name="fade">
					<Icon
						v-if="!appStore.isLoading"
						name="vault"
						size="18"
						color="primary"
					/>
					<Spinner v-else size="16" color="--txt-primary" />
				</Transition>

				<Text
					size="13"
					weight="600"
					color="primary"
					:class="$style.account_name"
				>
					{{ appStore.account.name }}
				</Text>

				<!-- <Text
				@click.stop="handleCopyAddress"
				size="13"
				weight="600"
				color="body"
				class="copyable"
			>
				{{ appStore.account.address.slice(0, 4) }}
				•••
				{{ appStore.account.address.slice(-4) }}
			</Text> -->
				<Icon name="chevron" size="12" color="secondary" />
			</Flex>
		</Flex>

		<Flex
			@click="handleOpenPopup('networks')"
			align="center"
			justify="center"
			:class="[$style.button, !appStore.isLogined && $style.disabled]"
		>
			<Icon name="globe" size="18" color="primary" />
			<div :class="$style.dot" />
		</Flex>
	</Flex>
</template>

<style module>
.wrapper {
	height: 48px;

	padding: 0 20px;
}

.button {
	position: relative;

	cursor: pointer;
	border-radius: 50%;
	background: var(--card-bg);
	box-shadow: inset 0 0 0 1px var(--border);

	padding: 4px;

	transition: all 0.2s var(--bezier);

	&:hover {
		background: var(--gray-15);
		box-shadow: inset 0 0 0 1px var(--border-hovered);
	}

	&:active {
		background: var(--gray-20);
	}

	&.disabled {
		opacity: 0.5;
		pointer-events: none;
	}
}

.dot {
	position: absolute;
	top: 5px;
	right: 5px;

	width: 5px;
	height: 5px;
	box-sizing: content-box;

	box-shadow: 0 0 0 2px var(--card-bg);

	border-radius: 50%;
	background: var(--orange);
}

.account {
	height: 28px;

	border-radius: 50px;
	background: var(--card-bg);
	box-shadow: inset 0 0 0 1px var(--border);
	cursor: pointer;

	padding: 0 10px 0 6px;

	transition: all 0.2s var(--bezier);

	&:hover {
		box-shadow: inset 0 0 0 1px var(--border-hovered);
	}
}

.account_name {
	max-width: 90px;

	overflow: hidden;
	text-overflow: ellipsis;
}
</style>
