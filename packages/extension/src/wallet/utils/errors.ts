export const getErrorData = (error: unknown) => (error as Error)?.stack ?? getErrorMessage(error)

export const getErrorMessage = (error: unknown) => (error as Error)?.message ?? (error as string) ?? "Unknown error"
