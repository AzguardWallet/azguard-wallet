import { vi } from "vitest";
import { IMessage } from "@/wallet/base/port-service/messages";

export type ChromePortFixture = {
    emitMessage: (message: IMessage) => void;
    captureMessage: (message: IMessage) => void;
    cleanup: () => void;
};

export function createChromePortFixture(): ChromePortFixture {
    const emitMessageMock = vi.fn();

    const mockPort = {
        onMessage: {
            addListener: vi.fn().mockImplementation(listener => {
                emitMessageMock.mockImplementation(message => listener(message));
            }),
            removeListener: vi.fn(),
        },
        onDisconnect: {
            addListener: vi.fn(),
            removeListener: vi.fn(),
        },
        postMessage: vi.fn(),
    };

    vi.stubGlobal("chrome", {
        runtime: {
            connect: vi.fn().mockReturnValue(mockPort),
        },
    });

    return {
        emitMessage: emitMessageMock,
        captureMessage: mockPort.postMessage,
        cleanup: () => {
            vi.unstubAllGlobals();
            vi.clearAllMocks();
        },
    };
}
