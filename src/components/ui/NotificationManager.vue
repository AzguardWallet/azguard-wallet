<script setup>
import { useNotificationStore } from "@/stores/notification.store"
const notificationStore = useNotificationStore()

const notification = computed(() => notificationStore.active)
const confirmBtnType =  computed(() => {
    switch (notification.value?.type) {
        case "info":
            return "primary"
        case "warning":
            return "red"
        default:
            return "secondary"
    }
})

const isLoading = ref(false)
const confirm = async () => {
    isLoading.value = true
    try {
        await notification.value?.payload.onConfirm?.()
    } catch (err) {
        console.error(err);
    } finally {
        isLoading.value = false
        notificationStore.removeActive()
    }
}

const cancel = async () => {
    isLoading.value = true
    try {
        await notification.value?.payload.onCancel?.()
    } catch (err) {
        console.error(err);
    } finally {
        isLoading.value = false
        notificationStore.removeActive()
    }
}
</script>

<template>
	<Teleport to="body">
        <Flex v-if="notification" wide direction="column" gap="32" :class="$style.wrapper">
            <Flex align="center" direction="column" gap="12" :class="$style.card">
                <Flex align="center" gap="8">
                    <Icon
                        v-if="notification.type === 'warning'"
                        name="warning"
                        size="18"
                        color="orange"
                    />

                    <Text size="16" weight="600" color="primary">
                        {{ notification.payload.title }}
                    </Text>
                </Flex>

                <Text size="14" weight="500" color="body" height="140" align="center">
                    {{ notification.payload.description }}
                </Text>

                <Flex gap="12" wide>
                    <Button
                        v-if="notification.payload.onCancel"
                        @click="cancel"
                        wide
                        type="secondary"
                        size="medium"
                    >
                        {{ notification.payload.cancelText || "Cancel" }}
                    </Button>

                    <Button
                        v-if="notification.payload.onConfirm"
                        @click="confirm"
                        wide
                        :type="confirmBtnType"
                        :loading="isLoading"
                        size="medium"
                    >
                        {{ notification.payload.confirmText || "Confirm" }}
                    </Button>
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
	background: var(--card-bg);
	box-shadow: 0 0 0 1px var(--border), 0 -6px 16px var(--shadow-5);

	width: 90%;
	padding: 24px;
	border-radius: 16px;

    transition: transform 0.3s ease, opacity 0.3s ease;
}
</style>
