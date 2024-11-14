export const storage = chrome.storage;

export type StorageArea = chrome.storage.StorageArea;

export enum StorageType {
    Local,
    Session,
}

export * from './entity_storage';
export * from './simple_storage';