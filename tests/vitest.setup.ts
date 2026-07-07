import { afterEach, beforeEach, Mock, vi } from "vitest";

export const emitPortMessage = (service: string, message: any) => {
    const listeners = portMessageListeners.get(service);
    if (listeners) {
        for (const listener of listeners) {
            listener(message);
        }
    }
};

export const capturePortMessage = (service: string) => {
    const fnMock = sendPortMessageMocks.get(service);
    if (!fnMock) {
        throw new Error(`Port for '${service}' hasn't been mocked`);
    }
    return fnMock;
};

export const emitMessage = (message: any) => {
    for (const listener of messageListeners) {
        listener(message);
    }
};

export const captureMessage = () => {
    return sendMessageMock;
};

type Fn = (...args: any[]) => void;

// In-memory chrome.storage.StorageArea; a fresh pair is stubbed into `chrome` before each test.
export const makeStorageArea = () => {
    const data = new Map<string, unknown>();
    return {
        get: async (key?: string) => {
            if (key === undefined) return Object.fromEntries(data);
            return data.has(key) ? { [key]: data.get(key) } : {};
        },
        set: async (items: Record<string, unknown>) => {
            for (const [k, v] of Object.entries(items)) data.set(k, v);
        },
        remove: async (key: string) => {
            data.delete(key);
        },
    };
};

const portMessageListeners = new Map<string, Fn[]>();
const sendPortMessageMocks = new Map<string, Mock<Fn>>();
const messageListeners: Fn[] = [];
const sendMessageMock = vi.fn();

const mockPort = (service: string) => {
    if (sendPortMessageMocks.has(service)) {
        throw new Error(`Port for '${service}' has already been mocked`);
    }

    const postMessageMock = vi.fn();
    sendPortMessageMocks.set(service, postMessageMock);

    return {
        disconnect: vi.fn(),
        onMessage: {
            addListener: (listener: Fn) => {
                let listeners = portMessageListeners.get(service);
                if (!listeners) {
                    listeners = [];
                    portMessageListeners.set(service, listeners);
                }
                listeners.push(listener);
            },
            removeListener: (listener: Fn) => {
                const listeners = portMessageListeners.get(service);
                if (listeners) {
                    for (let i = listeners.length - 1; i >= 0; i--) {
                        if (listeners[i] === listener) {
                            listeners.splice(i, 1);
                        }
                    }
                }
            },
        },
        onDisconnect: {
            addListener: vi.fn(),
            removeListener: vi.fn(),
        },
        postMessage: postMessageMock,
    };
};

beforeEach(() => {
    vi.stubGlobal("chrome", {
        storage: {
            local: makeStorageArea(),
            session: makeStorageArea(),
        },
        runtime: {
            connect: vi.fn().mockImplementation((_, { name }) => mockPort(name)),
            getContexts: vi.fn(),
            getURL: vi.fn(),
            onConnect: {
                addListener: vi.fn(),
                removeListener: vi.fn(),
            },
            onMessage: {
                addListener: (listener: Fn) => {
                    messageListeners.push(listener);
                },
                removeListener: (listener: Fn) => {
                    for (let i = messageListeners.length - 1; i >= 0; i--) {
                        if (messageListeners[i] === listener) {
                            messageListeners.splice(i, 1);
                        }
                    }
                },
            },
            sendMessage: sendMessageMock,
        },
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    portMessageListeners.clear();
    sendPortMessageMocks.clear();
    messageListeners.splice(0);
    sendMessageMock.mockClear();
});
