import { expect, test, vi, beforeEach, afterEach } from "vitest";
import { TASK_SERVICE_NAME, TaskServiceClient, TaskServiceMethod } from "..";
import { TaskServiceEvent, TaskServiceEventMessage } from "../events";
import { TaskStatus, StepContent } from "../models";
import { createChromePortFixture, ChromePortFixture } from "./chrome-port.fixture";

let portFixture: ChromePortFixture;

beforeEach(() => {
    portFixture = createChromePortFixture();
});

afterEach(() => {
    portFixture.cleanup();
});

const createMockTask = () => ({
    id: "12345678",
    content: new StepContent("Test Step"),
    status: TaskStatus.Processing,
    createdAt: Date.now(),
    startedAt: Date.now(),
    subtasks: [],
    source: "test_source",
    parent: undefined,
    finishedAt: undefined,
    result: undefined,
    error: undefined,
});

test("handles task created event", () => {
    const onTaskCreated = vi.fn();
    new TaskServiceClient(undefined, undefined, onTaskCreated);
    const task = createMockTask();

    portFixture.emitMessage(new TaskServiceEventMessage(TaskServiceEvent.TaskCreated, task));

    expect(onTaskCreated).toHaveBeenCalledWith(task);
});

test("handles task updated event", () => {
    const onTaskUpdated = vi.fn();
    new TaskServiceClient(undefined, undefined, undefined, onTaskUpdated);
    const task = createMockTask();

    portFixture.emitMessage(new TaskServiceEventMessage(TaskServiceEvent.TaskUpdated, task));

    expect(onTaskUpdated).toHaveBeenCalledWith(task);
});

test("handles task deleted event", () => {
    const onTaskDeleted = vi.fn();
    new TaskServiceClient(undefined, undefined, undefined, undefined, onTaskDeleted);
    const task = createMockTask();

    portFixture.emitMessage(new TaskServiceEventMessage(TaskServiceEvent.TaskDeleted, task));

    expect(onTaskDeleted).toHaveBeenCalledWith(task);
});

test("makes get task request", async () => {
    const client = new TaskServiceClient();
    const taskId = "test-id";

    client.getTask(taskId);

    expect(portFixture.captureMessage).toHaveBeenCalledWith(
        expect.objectContaining({
            taskId,
            method: TaskServiceMethod.GetTask,
            service: TASK_SERVICE_NAME,
        }),
    );
});

test("makes get all tasks request", async () => {
    const client = new TaskServiceClient();

    client.getAllTasks();

    expect(portFixture.captureMessage).toHaveBeenCalledWith(
        expect.objectContaining({
            method: TaskServiceMethod.GetAllTasks,
            service: TASK_SERVICE_NAME,
        }),
    );
});
