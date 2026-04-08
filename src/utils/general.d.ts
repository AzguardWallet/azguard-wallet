export function isPrefersDarkScheme(): boolean

export function debounce<T extends (...args: any[]) => any>(fn: T, delay: number): (...args: Parameters<T>) => void

export function ensurePermissions(perms: chrome.permissions.Permissions): Promise<boolean>
