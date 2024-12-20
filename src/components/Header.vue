<script setup>
/** Utils */
import { getNetworkType } from "@/components/ui/utils.js"

/** Composables */
import { useSettings } from "@/composables/settings.js"
const { settings } = useSettings()

/** Store */
import { useAppStore } from "@/stores/app.store"
import { usePopupStore } from "@/stores/popup.store"
const appStore = useAppStore()
const popupStore = usePopupStore()

const handleOpenPopup = target => {
	if (!appStore.isLogined) return
	popupStore.open(target)
}
</script>

<template>
	<Flex v-if="!appStore._isHomeScreenOpened" align="center" justify="between" :class="$style.wrapper">
		<Flex
			v-if="appStore.isLogined"
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
				<Icon name="vault" size="18" color="primary" />

				<Text size="13" weight="600" color="primary" :class="$style.account_name">
					{{ appStore.account.name }}
				</Text>

				<Text
					v-if="settings.appearance.showNode"
					size="13"
					weight="600"
					color="tertiary"
					:class="$style.network_type"
				>
					• &nbsp;{{ getNetworkType(appStore.network.chainId) }}
				</Text>

				<Icon name="chevron" size="12" color="secondary" />
			</Flex>
		</Flex>

		<Tooltip side="left">
			<Flex
				v-if="appStore.isLogined"
				@click="handleOpenPopup('networks')"
				align="center"
				justify="center"
				:class="[$style.button, !appStore.isLogined && $style.disabled]"
			>
				<Icon name="globe" size="18" color="primary" />
				<div :class="[$style.dot, $style[String(appStore.networkStatus).toLowerCase()]]" />
			</Flex>

			<template #content>
				<Flex align="center" gap="2">
					<Text size="12" color="secondary">Node status:</Text>
					<Text size="12" :class="$style[String(appStore.networkStatus).toLowerCase()]">
						{{ appStore.networkStatus }}
					</Text>
				</Flex>
			</template>
		</Tooltip>
	</Flex>
</template>

<style module>
.wrapper {
	height: 48px;
	min-height: 48px;

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

@keyframes loading {
	0% {
		opacity: 1;
	}

	25% {
		opacity: 0.8;
	}

	50% {
		opacity: 0.4;
	}

	70% {
		opacity: 0.8;
	}

	100% {
		opacity: 1;
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
	background: var(--gray);

	&.active {
		background: var(--green);
	}
	&.inactive {
		background: var(--red);
	}
	&.invalidchain {
		background: var(--red);
	}
	&.sync {
		background: var(--gray);
		animation: loading 1.5s infinite linear;
	}
}

.active {
	color: var(--green);
}
.inactive {
	color: var(--red);
}
.invalidchain {
	color: var(--red);
}
.sync {
	color: var(--gray);
	animation: loading 1.5s infinite linear;
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

	text-wrap: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.network_type {
	max-width: 90px;

	text-wrap: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}
</style>
