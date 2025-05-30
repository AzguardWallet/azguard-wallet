import { expect, test, vi, beforeEach, afterEach, describe } from "vitest";
import { TaskTrackerService, TASK_RETENTION_PERIOD_MS } from "../index";
import { StepTask, TaskStatus, TaskKind, ITask } from "../client/models";
import { TaskTrackerServiceEvent } from "../client/events";

const createTestSetup = () => {
    const emitMock = vi.fn();
    const service = new TaskTrackerService(emitMock);

    const pendingTask = new StepTask(
        {
            label: "Pending Task",
        },
        TaskStatus.Pending,
        "test_source",
    );

    const rootTask = new StepTask({ label: "Root Task" });

    const stepOne = new StepTask({
        label: "Step One",
        estimatedTime: 1000,
    });

    const stepTwo = new StepTask({
        label: "Step Two",
        estimatedTime: 2000,
    });

    const expectEvent = (event: TaskTrackerServiceEvent, task: ITask) => {
        expect(emitMock).toHaveBeenCalledWith(
            expect.objectContaining({
                event,
                task,
            }),
        );
    };

    return {
        service,
        rootTask,
        pendingTask,
        stepOne,
        stepTwo,
        expectEvent,
    };
};

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
});

describe("Task Tree Implementation", () => {
    describe("Task Creation and Structure", () => {
        test("should create root task without parent", () => {
            const { service, rootTask, expectEvent } = createTestSetup();
            const task = service.createTask(rootTask);

            expect(task.id).toBeDefined();
            expect(task.parentId).toBeUndefined();
            expect(task.kind).toBe(TaskKind.Step);
            expect(task.status).toBe(TaskStatus.Processing);
            expect(task.subtasks).toEqual([]);
            expectEvent(TaskTrackerServiceEvent.TaskCreated, task);
        });

        test("should create subtask with parentId", () => {
            const { service, rootTask, stepOne, expectEvent } = createTestSetup();
            const parentTask = service.createTask(rootTask);

            const childTask = service.createTask(stepOne, parentTask.id);

            expect(childTask.parentId).toBe(parentTask.id);
            expect(childTask.kind).toBe(TaskKind.Step);

            const updatedParent = service.getTask(parentTask.id);
            expect(updatedParent.subtasks).toHaveLength(1);
            expect(updatedParent.subtasks).toContainEqual(childTask);

            expectEvent(TaskTrackerServiceEvent.TaskCreated, childTask);
            expectEvent(TaskTrackerServiceEvent.TaskUpdated, updatedParent);
        });

        test("should create multiple parallel subtasks", () => {
            const { service, rootTask, stepOne, stepTwo } = createTestSetup();
            const parentTask = service.createTask(rootTask);

            const childOne = service.createTask(stepOne, parentTask.id);
            const childTwo = service.createTask(stepTwo, parentTask.id);

            const updatedParent = service.getTask(parentTask.id);
            expect(updatedParent.subtasks).toHaveLength(2);
            expect(updatedParent.subtasks).toContainEqual(childOne);
            expect(updatedParent.subtasks).toContainEqual(childTwo);
        });

        test("should throw error when creating subtask for finished parent", () => {
            const { service, rootTask, stepOne } = createTestSetup();
            const parentTask = service.createTask(rootTask);

            service.completeTask(parentTask.id, "completed");

            expect(() => service.createTask(stepOne, parentTask.id)).toThrow(
                `Cannot add task to finished parent ${parentTask.id}`,
            );
        });

        test("should throw error when creating subtask for non-existent parent", () => {
            const { service, stepOne } = createTestSetup();

            expect(() => service.createTask(stepOne, "non-existent")).toThrow(
                "Parent task non-existent does not exist",
            );
        });

        test("should be able to create with completed status", () => {
            const { service, expectEvent } = createTestSetup();

            const completedTask = new StepTask(
                { label: "Completed Task" },
                TaskStatus.Completed,
                "test_source",
                Date.now(),
                Date.now(),
                undefined,
            );
            const createdCompletedTask = service.createTask(completedTask);

            expect(createdCompletedTask.status).toBe(TaskStatus.Completed);
            expect(createdCompletedTask.finishedAt).toBeDefined();
            expect(createdCompletedTask.result).toBeUndefined();
            expectEvent(TaskTrackerServiceEvent.TaskCreated, createdCompletedTask);
        });

        test("should return root tasks from getTasks", () => {
            const { service } = createTestSetup();

            const root = service.createTask(new StepTask({ label: "Root" }));
            service.createTask(new StepTask({ label: "Step One" }), root.id);
            const stepTwo = service.createTask(new StepTask({ label: "Step Two" }), root.id);
            service.createTask(new StepTask({ label: "Step Two A" }), stepTwo.id);
            service.createTask(new StepTask({ label: "Step Two B" }), stepTwo.id);

            const rootTasks = service.getTasks();

            expect(rootTasks).toMatchObject([
                {
                    content: { label: "Root" },
                    subtasks: [
                        { content: { label: "Step One" }, subtasks: [] },
                        {
                            content: { label: "Step Two" },
                            subtasks: [
                                { content: { label: "Step Two A" }, subtasks: [] },
                                { content: { label: "Step Two B" }, subtasks: [] },
                            ],
                        },
                    ],
                },
            ]);
        });
    });

    describe("Task Status Management", () => {
        test("should start task and change status from Pending to Processing", () => {
            const { service, pendingTask, expectEvent } = createTestSetup();
            const task = service.createTask(pendingTask);

            service.startTask(task.id);

            const updatedTask = service.getTask(task.id);
            expect(updatedTask.status).toBe(TaskStatus.Processing);
            expectEvent(TaskTrackerServiceEvent.TaskUpdated, updatedTask);
        });

        test("should throw error when starting non-pending task", () => {
            const { service, pendingTask } = createTestSetup();
            const task = service.createTask(pendingTask);

            service.startTask(task.id);

            expect(() => service.startTask(task.id)).toThrow(`Cannot start task ${task.id} that is not pending`);
        });
    });

    describe("Task Completion Scenarios", () => {
        test("should complete task with result", () => {
            const { service, rootTask, expectEvent } = createTestSetup();
            const task = service.createTask(rootTask);
            const result = "Task completed";

            service.completeTask(task.id, result);

            const updatedTask = service.getTask(task.id);
            expect(updatedTask.finishedAt).toBeDefined();
            expect(updatedTask.result).toEqual(result);
            expect(updatedTask.error).toBeUndefined();
            expect(updatedTask.status).toBe(TaskStatus.Completed);

            expectEvent(TaskTrackerServiceEvent.TaskUpdated, updatedTask);
        });

        test("should complete task with error", () => {
            const { service, rootTask, expectEvent } = createTestSetup();
            const task = service.createTask(rootTask);
            const error = "Validation failed";

            service.completeTask(task.id, undefined, error);

            const updatedTask = service.getTask(task.id);
            expect(updatedTask.finishedAt).toBeDefined();
            expect(updatedTask.error).toBe(error);
            expect(updatedTask.result).toBeUndefined();
            expect(updatedTask.status).toBe(TaskStatus.Failed);

            expectEvent(TaskTrackerServiceEvent.TaskUpdated, updatedTask);
        });

        test("should throw error when completing task with unfinished subtasks", () => {
            const { service, rootTask, stepOne } = createTestSetup();
            const parentTask = service.createTask(rootTask);
            const childTask = service.createTask(stepOne, parentTask.id);

            expect(() => service.completeTask(parentTask.id, "success")).toThrow(
                `Cannot complete task ${parentTask.id} with unfinished subtasks: ${childTask.id}`,
            );
        });

        test("should throw error when completing non-existent task", () => {
            const { service } = createTestSetup();

            expect(() => service.completeTask("non-existent")).toThrow("Task non-existent does not exist");
        });

        test("should throw error when completing task with both result and error", () => {
            const { service, rootTask } = createTestSetup();
            const task = service.createTask(rootTask);

            expect(() => service.completeTask(task.id, "success", "error")).toThrow(
                "Cannot complete task with both result and error",
            );
        });
    });

    describe("Cleanup with Complex Tree Structures", () => {
        test("should cleanup entire tree when root expires", () => {
            const { service, rootTask, stepOne, stepTwo, expectEvent } = createTestSetup();
            const root = service.createTask(rootTask);

            const childOne = service.createTask(stepOne, root.id);
            const childTwo = service.createTask(stepTwo, childOne.id);

            service.completeTask(childTwo.id, "success");
            service.completeTask(childOne.id, "success");
            service.completeTask(root.id, "success");

            vi.setSystemTime(Date.now() + TASK_RETENTION_PERIOD_MS + 1000);

            service.getTasks();

            expect(() => service.getTask(root.id)).toThrow("Invalid task id");
            expect(() => service.getTask(childOne.id)).toThrow("Invalid task id");
            expect(() => service.getTask(childTwo.id)).toThrow("Invalid task id");

            expectEvent(TaskTrackerServiceEvent.TaskDeleted, root);
            expectEvent(TaskTrackerServiceEvent.TaskDeleted, childOne);
            expectEvent(TaskTrackerServiceEvent.TaskDeleted, childTwo);
        });

        test("should not cleanup unfinished tasks", () => {
            const { service, rootTask } = createTestSetup();
            const root = service.createTask(rootTask);

            vi.setSystemTime(Date.now() + TASK_RETENTION_PERIOD_MS + 1000);

            expect(service.getTask(root.id)).toBeDefined();
        });

        test("should cleanup only expired root tasks", () => {
            const { service, rootTask } = createTestSetup();
            const completed = service.createTask(rootTask);
            service.completeTask(completed.id, "success");
            const active = service.createTask(rootTask);

            vi.setSystemTime(Date.now() + TASK_RETENTION_PERIOD_MS + 1000);

            expect(() => service.getTask(completed.id)).toThrow("Invalid task id");
            expect(service.getTask(active.id)).toBeDefined();
        });
    });
});
