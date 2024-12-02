<script setup>
/** Vendor */
import { onMounted } from "vue"

/** Components */
import Navigation from "../../../../components/Navigation.vue"

/** Utils */
import { managers } from "@/utils/core"

const route = useRoute()
const router = useRouter()

const session = ref()
const fetchSession = async () => {
	const id = route.params.id
	
	session.value = await managers.interaction.getDappSession({ id })
	
	if (!session.value) {
		router.push('/popup/settings/dappSessions')
		return
	}

	session.value.imageLoaded = !!session.value.icon
}

const onImageError = () => {
	session.value.imageLoaded = false
}

const handleDropSession = () => {
	managers.wallectConnect.dropDappSession(session.value)

	router.push('/popup/settings/dappSessions')
}

onMounted( async () => {
	await fetchSession()
})

const jsonData = {
    "method": "aztec_execute",
    "params": [
      {
        "type": "call",
        "contract": "0x03f5eb79b443df7879b6903082dc0585d235011fdf42c91594c72dce2d64adc3",
        "method": "transfer",
        "args": [
          "0x02c2a6d5a406673674d8405ecb48f7cb26322a6b7d7724ee1b47be8c61d0467f",
          1
        ]
      },
      {
        "type": "add_capsule",
        "capsule": [
          "0x02c2a6d5a406673674d8405ecb48f7cb26322a6b7d7724ee1b47be8c61d0467f"
        ]
      },
      {
        "type": "add_contact",
        "address": "0x03f5eb79b443df7879b6903082dc0585d235011fdf42c91594c72dce2d64adc3"
      },
      {
        "type": "authorize_call",
        "registry": false,
        "caller": "0x0249ff6810cafb31ac99511292d0104ba160292bed3ca4a0eb9d7ac2f37e5371",
        "contract": "0x03f5eb79b443df7879b6903082dc0585d235011fdf42c91594c72dce2d64adc3",
        "method": "transfer_public",
        "args": [
          "0x0249ff6810cafb31ac99511292d0104ba160292bed3ca4a0eb9d7ac2f37e5371",
          "0x02c2a6d5a406673674d8405ecb48f7cb26322a6b7d7724ee1b47be8c61d0467f",
          "100",
          0
        ]
      },
      {
        "type": "authorize_call",
        "registry": true,
        "caller": "0x0249ff6810cafb31ac99511292d0104ba160292bed3ca4a0eb9d7ac2f37e5371",
        "contract": "0x03f5eb79b443df7879b6903082dc0585d235011fdf42c91594c72dce2d64adc3",
        "method": "transfer_public",
        "args": [
          "0x0249ff6810cafb31ac99511292d0104ba160292bed3ca4a0eb9d7ac2f37e5371",
          "0x02c2a6d5a406673674d8405ecb48f7cb26322a6b7d7724ee1b47be8c61d0467f",
          "100",
          0
        ]
      },
      {
        "type": "authorize_intent",
        "registry": false,
        "consumer": "0x03f5eb79b443df7879b6903082dc0585d235011fdf42c91594c72dce2d64adc3",
        "intent": [
          "0x02c2a6d5a406673674d8405ecb48f7cb26322a6b7d7724ee1b47be8c61d0467f"
        ]
      },
      {
        "type": "authorize_intent",
        "registry": true,
        "consumer": "0x03f5eb79b443df7879b6903082dc0585d235011fdf42c91594c72dce2d64adc3",
        "intent": [
          "0x02c2a6d5a406673674d8405ecb48f7cb26322a6b7d7724ee1b47be8c61d0467f"
        ]
      },
      {
        "type": "call",
        "contract": "0x03f5eb79b443df7879b6903082dc0585d235011fdf42c91594c72dce2d64adc3",
        "method": "transfer_public",
        "args": [
          "0x0249ff6810cafb31ac99511292d0104ba160292bed3ca4a0eb9d7ac2f37e5371",
          "0x02c2a6d5a406673674d8405ecb48f7cb26322a6b7d7724ee1b47be8c61d0467f",
          "100",
          0
        ]
      },
      {
        "type": "call",
        "contract": "0x03f5eb79b443df7879b6903082dc0585d235011fdf42c91594c72dce2d64adc3",
        "method": "transfer_public",
        "args": [
          "0x0249ff6810cafb31ac99511292d0104ba160292bed3ca4a0eb9d7ac2f37e5371",
          "0x02c2a6d5a406673674d8405ecb48f7cb26322a6b7d7724ee1b47be8c61d0467f",
          "100",
          0
        ]
      }
    ]
  }
</script>

<template>
	<Flex direction="column" gap="20" :class="$style.wrapper">
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
			<RouterLink to="/popup/settings/dappSessions">
				<Text
					size="13"
					weight="600"
					color="tertiary"
					style="line-height: 16px"
				>
					Dapp Sessions
				</Text>
			</RouterLink>
			<Text color="support">•</Text>
			<Text
				size="13"
				weight="600"
				color="tertiary"
				style="line-height: 16px"
			>
				{{ session?.name }}
			</Text>
		</Flex>

		<Flex direction="column" justify="between" :class="$style.session">
			<Flex justify="between">
				<Flex align="start" justify="start">
					<img
						v-if="session?.imageLoaded"
						:src="session?.icon"
						@error="onImageError()"
						width="48"
						height="48"
					/>

					<Icon
						v-else
						name="dapp"
						size="48"
						color="blue"
					/>
				</Flex>

				<Button @click="handleDropSession" type="secondary" size="mini">Disconnect</Button>
			</Flex>

			<Flex justify="between" align="end">
				<Flex direction="column" gap="6">
					<Text size="13" weight="600" color="primary">
						{{ session?.name }}
					</Text>
					<Text size="12" weight="600" color="tertiary" selectable>
						{{ session?.url }}
					</Text>
				</Flex>
			</Flex>
		</Flex>

		<Flex direction="column" align="start" justify="start" gap="8" :class="$style.accounts_section">
			<Text size="15" weight="600" color="primary">Shared accounts:</Text>

			<Flex direction="column" align="start" justify="start" gap="6" :class="$style.accounts">
				<Flex v-for="acc in session?.accounts" gap="10" :class="$style.account">
					<Flex direction="column" gap="4">
						<Text size="14" weight="600" color="primary">
							{{ acc.name }}
						</Text>
						<Text size="13" weight="600" color="tertiary">
							{{ `${acc.address.slice(0, 6)}...${acc.address.slice(-4)}` }}
						</Text>
					</Flex>
				</Flex>
			</Flex>
		</Flex>

		<Flex direction="column" align="start" justify="start" gap="8">
			<Text size="15" weight="600" color="primary">Session allowances:</Text>

			<Flex align="center" gap="4" :style="{paddingLeft: '4px'}">
				<Text size="13" color="secondary">Networks:</Text>
				<Text size="13" color="secondary"> {{ session?.params.chains.join(', ') }} </Text>
			</Flex>
			
			<Flex align="center" gap="4" :style="{paddingLeft: '4px'}">
				<Text size="13" color="secondary">Methods:</Text>
				<Text size="13" color="secondary"> {{ session?.params.methods.join(', ') }} </Text>
			</Flex>

			<Flex align="center" gap="4" :style="{paddingLeft: '4px'}">
				<Text size="13" color="secondary">Events:</Text>
				<Text size="13" color="secondary"> {{ session?.params.events.join(', ') }} </Text>
			</Flex>
		</Flex>

		<Navigation />
	</Flex>
</template>

<style module>
.wrapper {
	flex: 1;

	background: var(--card-bg);
	box-shadow: 0 0 0 1px var(--gray-5);

	border-top-left-radius: 24px;
	border-top-right-radius: 24px;

	padding: 20px 24px 24px 24px;
}

.session {
	min-height: 120px;

	background: linear-gradient(transparent, var(--gray-3));
	border-radius: 12px;
	box-shadow: inset 0 0 0 1px var(--gray-10);

	padding: 16px;
}

img {
	border-radius: 50%;
	transition: all 0.2s ease;
}

.accounts_section {
	width: 100%;
}

.accounts {
	width: 100%;
	max-height: 160px;
	overflow: auto;
}

.account {
	width: 100%;
	border-radius: 12px;
	box-shadow: inset 0 0 0 1px var(--gray-10), 0 1px 2px var(--gray-5);

	padding: 8px 12px 8px 12px;

	transition: all 0.2s var(--bezier);
}
</style>
