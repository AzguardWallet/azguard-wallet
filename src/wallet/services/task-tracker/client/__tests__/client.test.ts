import { expect, test, vi, beforeEach, afterEach } from "vitest";
import { TASK_TRACKER_SERVICE_NAME, TaskTrackerServiceClient, TaskTrackerServiceMethod } from "../";
import { TaskTrackerServiceEvent, TaskTrackerServiceEventMessage } from "../events";
import { TaskKind, TaskStatus } from "../models";
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
    kind: TaskKind.Step,
    content: { label: "Test Step" },
    source: "test_source",
    createdAt: Date.now(),
    status: TaskStatus.Processing,
    subtasks: [],
});

test("handles task created event", () => {
    const onTaskCreated = vi.fn();
    new TaskTrackerServiceClient(undefined, undefined, onTaskCreated);
    const task = createMockTask();

    portFixture.emitMessage(new TaskTrackerServiceEventMessage(TaskTrackerServiceEvent.TaskCreated, task));

    expect(onTaskCreated).toHaveBeenCalledWith(task);
});

test("handles task updated event", () => {
    const onTaskUpdated = vi.fn();
    new TaskTrackerServiceClient(undefined, undefined, undefined, onTaskUpdated);
    const task = createMockTask();

    portFixture.emitMessage(new TaskTrackerServiceEventMessage(TaskTrackerServiceEvent.TaskUpdated, task));

    expect(onTaskUpdated).toHaveBeenCalledWith(task);
});

test("handles task deleted event", () => {
    const onTaskDeleted = vi.fn();
    new TaskTrackerServiceClient(undefined, undefined, undefined, undefined, onTaskDeleted);
    const task = createMockTask();

    portFixture.emitMessage(new TaskTrackerServiceEventMessage(TaskTrackerServiceEvent.TaskDeleted, task));

    expect(onTaskDeleted).toHaveBeenCalledWith(task);
});

test("makes get task request", async () => {
    const client = new TaskTrackerServiceClient();
    const taskId = "test-id";

    client.getTask(taskId);

    expect(portFixture.captureMessage).toHaveBeenCalledWith(
        expect.objectContaining({
            taskId,
            method: TaskTrackerServiceMethod.GetTask,
            service: TASK_TRACKER_SERVICE_NAME,
        }),
    );
});

test("makes get all tasks request", async () => {
    const client = new TaskTrackerServiceClient();

    client.getAllTasks();

    expect(portFixture.captureMessage).toHaveBeenCalledWith(
        expect.objectContaining({
            method: TaskTrackerServiceMethod.GetAllTasks,
            service: TASK_TRACKER_SERVICE_NAME,
        }),
    );
});
