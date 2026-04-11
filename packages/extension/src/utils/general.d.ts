export function isPrefersDarkScheme(): boolean

export function debounce<T extends (...args: unknown[]) => unknown>(fn: T, delay: number): (...args: Parameters<T>) => void

export function ensurePermissions(perms: chrome.permissions.Permissions): Promise<boolean>
