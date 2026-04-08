<script setup>

import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()

const message = computed(() =>
	appStore.isLogined
		? {
				title: "Reconnecting to service worker...",
				description: "Hold on — we're restoring the connection.",
			}
		: {
				title: "Connecting to service worker...",
				description: "We're setting things up. This should only take a moment.",
			},
)
</script>
<template>
	<Teleport to="body">
        <Flex v-if="!isBackgroundConnected" wide direction="column" gap="32" :class="$style.wrapper">
            <Flex align="center" direction="column" gap="24" :class="$style.card">
                <div :class="$style.loader" />

                <Flex align="center" direction="column" gap="8">
                    <Text size="14" weight="600" color="primary">
                        {{ message.title }}
                    </Text>

                    <Text size="12" weight="500" color="secondary" height="140" align="center">
                        {{ message.description }}
                    </Text>
                </Flex>
            </Flex>
        </Flex>
	</Teleport>
</template>

<style module>
.wrapper {
	position: fixed;
	inset: 0;
	background-color: rgba(0, 0, 0, 0.4);
	backdrop-filter: blur(6px);
	display: flex;
	justify-content: center;
	align-items: center;
	z-index: 9999;
}

.card {
	width: 90%;
	padding: 24px;
	border-radius: 16px;

    transition: transform 0.3s ease, opacity 0.3s ease;
}

.loader {
    height: 12px;
    aspect-ratio: 4;
    --_g: no-repeat radial-gradient(farthest-side, var(--txt-secondary) 90%,#0000);
    background: 
        var(--_g) left,
        var(--_g) right;
    background-size: 25% 100%;
    display: grid;
}
.loader:before,
.loader:after {
    content: "";
    height: inherit;
    aspect-ratio: 1;
    grid-area: 1/1;
    margin: auto;
    border-radius: 50%;
    transform-origin: -100% 50%;
    background: var(--txt-secondary);
    animation: jumping-dots 1s infinite linear;
}
.loader:after {
    transform-origin: 200% 50%;
    --s:-1;
    animation-delay: -.5s;
}

@keyframes jumping-dots {
    58%,
    100% {transform: rotate(calc(var(--s, 1) * 1turn))}
}
</style>
