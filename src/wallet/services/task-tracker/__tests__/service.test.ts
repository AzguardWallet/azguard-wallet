import { expect, test, vi, beforeEach, afterEach, describe } from "vitest";
import { TaskTrackerService, TASK_RETENTION_PERIOD_MS } from "../index";
import { StepContent, TaskStatus, ContentKind, Task, EmptyResult, ITaskResult, ResultKind } from "../client/models";
import { TaskTrackerServiceEvent } from "../client/events";

class TestResult implements ITaskResult {
    public readonly kind = ResultKind.Empty;
    constructor(public readonly testData: string) {}
}

const createTestSetup = () => {
    const emitMock = vi.fn();
    const service = new TaskTrackerService(emitMock);

    const rootStepContent = new StepContent("Root Task");
    const stepOne = new StepContent("Step One", 1000);
    const stepTwo = new StepContent("Step Two", 2000);

    const expectEvent = (event: TaskTrackerServiceEvent, task: Task) => {
        expect(emitMock).toHaveBeenCalledWith(
            expect.objectContaining({
                event,
                task,
            }),
        );
    };

    return {
        service,
        rootStepContent,
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
        test("should create pending root task", () => {
            const { service, rootStepContent, expectEvent } = createTestSetup();

            const pendingTaskId = service.createNewTask(rootStepContent);
            const pendingTask = service.getTask(pendingTaskId);

            expect(pendingTask.parent).toBeUndefined();
            expect(pendingTask.content.kind).toBe(ContentKind.Step);
            expect(pendingTask.status).toBe(TaskStatus.Pending);
            expect(pendingTask.startedAt).toBeUndefined();
            expectEvent(TaskTrackerServiceEvent.TaskCreated, pendingTask);
        });

        test("should create processing root task", () => {
            const { service, rootStepContent, expectEvent } = createTestSetup();
            const processingTaskId = service.startNewTask(rootStepContent);
            const processingTask = service.getTask(processingTaskId);

            expect(processingTask.status).toBe(TaskStatus.Processing);
            expect(processingTask.startedAt).toBeDefined();
            expect(processingTask.startedAt).toBeGreaterThanOrEqual(processingTask.createdAt);
            expectEvent(TaskTrackerServiceEvent.TaskCreated, processingTask);
        });

        test("should create subtasks and maintain parent-child relationships", () => {
            const { service, rootStepContent, stepOne, stepTwo, expectEvent } = createTestSetup();
            const parentTaskId = service.createNewTask(rootStepContent);
            const childOneTaskId = service.createNewTask(stepOne, parentTaskId);
            const childTwoTaskId = service.createNewTask(stepTwo, parentTaskId);

            const parentTask = service.getTask(parentTaskId);
            const childOneTask = service.getTask(childOneTaskId);
            const childTwoTask = service.getTask(childTwoTaskId);

            const updatedParent = service.getTask(parentTaskId);
            expect(childOneTask.parent).toBe(parentTask);
            expect(childTwoTask.parent).toBe(parentTask);
            expect(updatedParent.subtasks).toHaveLength(2);
            expect(updatedParent.subtasks).toContainEqual(childOneTask);
            expect(updatedParent.subtasks).toContainEqual(childTwoTask);

            expectEvent(TaskTrackerServiceEvent.TaskCreated, childOneTask);
            expectEvent(TaskTrackerServiceEvent.TaskCreated, childTwoTask);
            expectEvent(TaskTrackerServiceEvent.TaskUpdated, updatedParent);
        });

        test("should handle creation errors", () => {
            const { service, rootStepContent, stepOne } = createTestSetup();
            const parentTaskId = service.createNewTask(rootStepContent);

            service.completeTask(parentTaskId);

            expect(() => service.createNewTask(stepOne, parentTaskId)).toThrow(
                `Cannot add task to finished parent ${parentTaskId}`,
            );

            expect(() => service.createNewTask(stepOne, "non-existent")).toThrow("Invalid task id: non-existent");
        });

        test("should return root tasks from getTasks", () => {
            const { service } = createTestSetup();

            const rootId = service.createNewTask(new StepContent("Root"));
            service.createNewTask(new StepContent("Step One"), rootId);
            const stepTwoId = service.createNewTask(new StepContent("Step Two"), rootId);
            service.createNewTask(new StepContent("Step Two A"), stepTwoId);

            const rootTasks = service.getTasks();

            expect(rootTasks).toMatchObject([
                {
                    content: { label: "Root" },
                    subtasks: [
                        { content: { label: "Step One" }, subtasks: [] },
                        {
                            content: { label: "Step Two" },
                            subtasks: [{ content: { label: "Step Two A" }, subtasks: [] }],
                        },
                    ],
                },
            ]);
        });
    });

    describe("Task Status Management", () => {
        test("should start task and change status from Pending to Processing", () => {
            const { service, expectEvent } = createTestSetup();
            const taskId = service.createNewTask(new StepContent("Pending Task"));

            service.startTask(taskId);

            const updatedTask = service.getTask(taskId);
            expect(updatedTask.status).toBe(TaskStatus.Processing);
            expect(updatedTask.startedAt).toBeDefined();
            expectEvent(TaskTrackerServiceEvent.TaskUpdated, updatedTask);
        });

        test("should throw error when starting non-pending task", () => {
            const { service, stepOne } = createTestSetup();
            const taskId = service.startNewTask(stepOne);

            expect(() => service.startTask(taskId)).toThrow(`Cannot start task ${taskId} that is not pending`);
        });
    });

    describe("Task Completion Scenarios", () => {
        test("should complete task with default result", () => {
            const { service, rootStepContent, expectEvent } = createTestSetup();

            const taskId = service.startNewTask(rootStepContent);
            service.completeTask(taskId);

            const completedTask = service.getTask(taskId);
            expect(completedTask.finishedAt).toBeDefined();
            expect(completedTask.result).toBeInstanceOf(EmptyResult);
            expect(completedTask.status).toBe(TaskStatus.Completed);
            expectEvent(TaskTrackerServiceEvent.TaskUpdated, completedTask);
        });

        test("should complete task with custom result", () => {
            const { service, rootStepContent } = createTestSetup();
            const taskId = service.startNewTask(rootStepContent);
            const customResult = new TestResult("test data");
            service.completeTask(taskId, customResult);

            const completedTask = service.getTask(taskId);
            expect(completedTask.result).toBe(customResult);
        });

        test("should fail task with error", () => {
            const { service, rootStepContent, expectEvent } = createTestSetup();
            const taskId = service.startNewTask(rootStepContent);
            const error = "Validation failed";

            service.failTask(taskId, error);

            const updatedTask = service.getTask(taskId);
            expect(updatedTask.finishedAt).toBeDefined();
            expect(updatedTask.error).toBe(error);
            expect(updatedTask.result).toBeUndefined();
            expect(updatedTask.status).toBe(TaskStatus.Failed);

            expectEvent(TaskTrackerServiceEvent.TaskUpdated, updatedTask);
        });

        test("should throw error when completing task with unfinished subtasks", () => {
            const { service, rootStepContent, stepOne } = createTestSetup();
            const parentTaskId = service.startNewTask(rootStepContent);
            const childTaskId = service.createNewTask(stepOne, parentTaskId);

            expect(() => service.completeTask(parentTaskId)).toThrow(
                `Cannot finish task ${parentTaskId} with unfinished subtasks: ${childTaskId}`,
            );
            expect(() => service.failTask(parentTaskId, "error")).toThrow(
                `Cannot finish task ${parentTaskId} with unfinished subtasks: ${childTaskId}`,
            );
        });

        test("should throw error when completing non-existent task", () => {
            const { service } = createTestSetup();

            expect(() => service.completeTask("non-existent")).toThrow("Invalid task id: non-existent");
            expect(() => service.failTask("non-existent", "error")).toThrow("Invalid task id: non-existent");
        });

        test("should throw error when completing already finished task", () => {
            const { service, rootStepContent } = createTestSetup();
            const taskId = service.startNewTask(rootStepContent);

            service.completeTask(taskId);
            expect(() => service.completeTask(taskId)).toThrow(`Cannot finish already finished task ${taskId}`);
            expect(() => service.failTask(taskId, "error")).toThrow(`Cannot finish already finished task ${taskId}`);
        });
    });

    describe("Cleanup with Complex Tree Structures", () => {
        test("should cleanup expired tasks and keep active tasks", () => {
            const { service, rootStepContent, stepOne, expectEvent } = createTestSetup();
            const completedRootId = service.startNewTask(rootStepContent);
            const completedChildId = service.createNewTask(stepOne, completedRootId);
            service.completeTask(completedChildId);
            service.completeTask(completedRootId);
            const activeRootId = service.startNewTask(new StepContent("Active Task"));
            const completedRoot = service.getTask(completedRootId);
            const completedChild = service.getTask(completedChildId);

            vi.setSystemTime(Date.now() + TASK_RETENTION_PERIOD_MS + 1000);

            service.getTasks();

            expect(() => service.getTask(completedRootId)).toThrow("Invalid task id");
            expect(() => service.getTask(completedChildId)).toThrow("Invalid task id");
            expect(service.getTask(activeRootId)).toBeDefined();
            expectEvent(TaskTrackerServiceEvent.TaskDeleted, completedRoot);
            expectEvent(TaskTrackerServiceEvent.TaskDeleted, completedChild);
        });
    });
});
