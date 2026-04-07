import { expect, test, vi } from "vitest";
import { EventMessage, MessageType } from "@/wallet/base/messages";
import { OriginType, TxOrigin } from "@/wallet/services/transaction/client";
import { emitPortMessage, capturePortMessage } from "../../../../tests/vitest.setup";
import { TASK_SERVICE_NAME, TaskServiceClient, TaskStatus, StepContent, Task, Events } from "./client";

const eventMessage = <T extends keyof Events>(event: T, payload: Events[T]): EventMessage<Events> => ({
    type: MessageType.Event,
    content: {
        event,
        payload,
    },
});

const createMockTask = () =>
    ({
        id: "12345678",
        content: new StepContent("Test Step"),
        status: TaskStatus.Processing,
        createdAt: Date.now(),
        startedAt: Date.now(),
        subtasks: [],
        origin: { type: OriginType.UI } satisfies TxOrigin,
        parentId: undefined,
        finishedAt: undefined,
        result: undefined,
        error: undefined,
    } satisfies Task);

test("handles task created event", async () => {
    const client = new TaskServiceClient();
    await client.connect();

    const onTaskCreated = vi.fn();
    client.onTaskCreated.add(onTaskCreated);
    const task = createMockTask();

    emitPortMessage(TASK_SERVICE_NAME, eventMessage("onTaskCreated", task));

    expect(onTaskCreated).toHaveBeenCalledWith(task);
});

test("handles task updated event", async () => {
    const client = new TaskServiceClient();
    await client.connect();

    const onTaskUpdated = vi.fn();
    client.onTaskUpdated.add(onTaskUpdated);
    const task = createMockTask();

    emitPortMessage(TASK_SERVICE_NAME, eventMessage("onTaskUpdated", task));

    expect(onTaskUpdated).toHaveBeenCalledWith(task);
});

test("handles task deleted event", async () => {
    const client = new TaskServiceClient();
    await client.connect();

    const onTaskDeleted = vi.fn();
    client.onTaskDeleted.add(onTaskDeleted);
    const task = createMockTask();

    emitPortMessage(TASK_SERVICE_NAME, eventMessage("onTaskDeleted", task));

    expect(onTaskDeleted).toHaveBeenCalledWith(task);
});

test("makes get task request", async () => {
    const client = new TaskServiceClient();
    const taskId = "test-id";

    client.getTask(taskId);

    expect(capturePortMessage(TASK_SERVICE_NAME)).toHaveBeenCalledWith(
        expect.objectContaining({
            type: MessageType.Request,
            content: expect.objectContaining({
                method: "getTask",
                params: { 0: taskId },
            }),
        }),
    );
});

test("makes get all tasks request", async () => {
    const client = new TaskServiceClient();

    client.getTasks();

    expect(capturePortMessage(TASK_SERVICE_NAME)).toHaveBeenCalledWith(
        expect.objectContaining({
            type: MessageType.Request,
            content: expect.objectContaining({
                method: "getTasks",
                params: {},
            }),
        }),
    );
});
