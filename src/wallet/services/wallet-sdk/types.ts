/**
 * Context derived from an active wallet-sdk session, passed to the dispatcher
 * so it can resolve the correct network, profile, and account for each call.
 */
export type SessionContext = {
	/** Aztec chain ID from the session's ChainInfo (e.g. 677868 for devnet). */
	chainId: number
	/** The active profile ID at the time the session was established. */
	profileId: string
	/** The dApp's origin URL (e.g. "https://mydapp.xyz"). */
	origin: string
	/** The wallet-sdk session ID (maps to BackgroundConnectionHandler.ActiveSession.sessionId). */
	sessionId: string
}
