import { AccessLevel } from "@/wallet/services/dapp-session/client"

export { AccessLevel } from "@/wallet/services/dapp-session/client"

export const confirmationPolicies = [
	{
		title: "Confirm everything",
		description: "Show confirmation popup on every request from this dapp",
		confirmationLevel: AccessLevel.None,
	},
	{
		title: "Confirm transactions and private data access",
		description:
			"Show confirmation popup only when this dapp sends or simulates transactions, or reads private data",
		confirmationLevel: AccessLevel.PrivateData,
	},
	{
		title: "Confirm transactions",
		description: "Show confirmation popup only when this dapp sends transactions",
		confirmationLevel: AccessLevel.Transactions,
	},
]
