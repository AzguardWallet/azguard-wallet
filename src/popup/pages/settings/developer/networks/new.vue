<script setup>
/** Components */
import Navigation from "../../../../components/Navigation.vue"

/** Utils */
import { managers } from "@/utils/core"

/** Store */
import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()

const router = useRouter()

if (!appStore.isLogined) router.push("/popup/auth")

const name = ref("")
const url = ref("https://rpc.tzkt.io/aztec/")

const handleCreate = async () => {
	if (!name.value.length) return
	if (!url.value.length) return

	const network = await managers.network.addNetwork(name.value, url.value)
	appStore.network = network
	appStore.networks = await managers.network.getNetworks()

	router.go(-1)
}
</script>

<template>
	<Flex direction="column" gap="12" :class="$style.wrapper">
		<Flex align="center" gap="8">
			<RouterLink to="/popup/settings">
				<Text
					size="13"
					weight="600"
					color="tertiary"
					style="line-height: 16px"
				>
					Settings
				</Text>
			</RouterLink>
			<Text color="support">•</Text>
			<RouterLink to="/popup/settings/developer">
				<Text
					size="13"
					weight="600"
					color="tertiary"
					style="line-height: 16px"
				>
					Developer
				</Text>
			</RouterLink>
			<Text color="support">•</Text>
			<RouterLink to="/popup/settings/developer/networks">
				<Text
					size="13"
					weight="600"
					color="tertiary"
					style="line-height: 16px"
				>
					Networks
				</Text>
			</RouterLink>
			<Text color="support">•</Text>
			<Text
				size="13"
				weight="600"
				color="tertiary"
				style="line-height: 16px"
			>
				New
			</Text>
		</Flex>

		<Flex direction="column" gap="24">
			<Text size="16" weight="600" color="primary">New network</Text>

			<Input
				label="Name"
				placeholder="My Network"
				v-model="name"
				autofocus
			/>
			<Input
				label="RPC URL"
				placeholder="http://localhost:1337"
				v-model="url"
			/>

			<Flex direction="column" gap="8">
				<Button @click="handleCreate" type="primary" size="medium" wide>
					<Text color="white">Create</Text>
				</Button>
			</Flex>
		</Flex>

		<Navigation />
	</Flex>
</template>

<style module>
.wrapper {
	flex: 1;

	background: #fff;
	box-shadow: 0 0 0 1px var(--gray-5);

	border-top-left-radius: 24px;
	border-top-right-radius: 24px;

	padding: 20px 24px 24px 24px;
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
</style>
