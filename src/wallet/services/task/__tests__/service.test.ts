import { expect, test, vi, beforeEach, afterEach, describe } from "vitest";
import { TaskService, TASK_RETENTION_PERIOD_MS } from "../index";
import { StepContent, TaskStatus, ContentKind, Task, EmptyResult, ITaskResult, ResultKind } from "../client/models";
import { TaskServiceEvent } from "../client/events";
import { OriginType, TxOrigin } from "@/wallet/services/transaction/client";
import { ProfileService } from "@/wallet/services/profile";
import { InMemoryLogs } from "@/wallet/services/logger/client";

class TestResult implements ITaskResult {
    public readonly kind = ResultKind.Empty;
    constructor(public readonly testData: string) {}
}

const createTestSetup = () => {
    const emitMock = vi.fn();
    const profileMock = {
        onActiveProfileChanged: [] as ((id?: string) => void)[],
    } as unknown as ProfileService;
    const logs = new InMemoryLogs();
    const service = new TaskService(profileMock, logs, emitMock);

    const switchToProfile = (id?: string) => {
        profileMock.onActiveProfileChanged.forEach(cb => cb(id));
    };

    const rootStepContent = new StepContent("Root Task");
    const stepOne = new StepContent("Step One", 1000);
    const stepTwo = new StepContent("Step Two", 2000);

    const expectEvent = (event: TaskServiceEvent, task: Task) => {
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
        switchToProfile,
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

            const pendingTask = service.createNewTask(rootStepContent);

            expect(pendingTask.task.parent).toBeUndefined();
            expect(pendingTask.task.content.kind).toBe(ContentKind.Step);
            expect(pendingTask.task.status).toBe(TaskStatus.Pending);
            expect(pendingTask.task.startedAt).toBeUndefined();
            expectEvent(TaskServiceEvent.TaskCreated, pendingTask.task);
        });

        test("should create processing root task", () => {
            const { service, rootStepContent, expectEvent } = createTestSetup();

            const processingTask = service.startNewTask(rootStepContent);

            expect(processingTask.task.status).toBe(TaskStatus.Processing);
            expect(processingTask.task.startedAt).toBeDefined();
            expect(processingTask.task.startedAt).toBeGreaterThanOrEqual(processingTask.task.createdAt);
            expectEvent(TaskServiceEvent.TaskCreated, processingTask.task);
        });

        test("should create subtasks and maintain parent-child relationships", () => {
            const { service, rootStepContent, stepOne, stepTwo, expectEvent } = createTestSetup();

            const parentTask = service.createNewTask(rootStepContent);
            const childOne = parentTask.createSubtask(stepOne);
            const childTwo = parentTask.createSubtask(stepTwo);

            expect(childOne.task.parent).toBe(parentTask.task);
            expect(childTwo.task.parent).toBe(parentTask.task);
            expect(parentTask.task.subtasks).toHaveLength(2);
            expect(parentTask.task.subtasks).toContainEqual(childOne.task);
            expect(parentTask.task.subtasks).toContainEqual(childTwo.task);

            expectEvent(TaskServiceEvent.TaskCreated, childOne.task);
            expectEvent(TaskServiceEvent.TaskCreated, childTwo.task);
            expectEvent(TaskServiceEvent.TaskUpdated, parentTask.task);
        });

        test("should handle creation errors", () => {
            const { service, rootStepContent, stepOne } = createTestSetup();

            const completedParent = service.startNewTask(rootStepContent);
            completedParent.complete();

            expect(() => service.createNewTask(stepOne, completedParent.id)).toThrow(
                `Cannot add task to finished parent ${completedParent.id}`,
            );

            expect(() => service.createNewTask(stepOne, "non-existent")).toThrow("Invalid task id: non-existent");
        });

        test("should return root tasks from getTasks", () => {
            const { service } = createTestSetup();

            const rootTask = service.createNewTask(new StepContent("Root"));
            rootTask.createSubtask(new StepContent("Step One"));
            const stepTwoTask = rootTask.createSubtask(new StepContent("Step Two"));
            stepTwoTask.createSubtask(new StepContent("Step Two A"));

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

        test("should propagate origin to subtasks", () => {
            const { service } = createTestSetup();
            const origin = new TxOrigin(OriginType.UI);

            const rootTask = service.createNewTask(new StepContent("Root"), undefined, origin);
            const subtask = rootTask.createSubtask(new StepContent("Subtask"));

            expect(rootTask.origin).toBe(origin);
            expect(subtask.origin).toBe(origin);
            expect(subtask.task.origin).toBe(origin);
        });
    });

    describe("Task Status Management", () => {
        test("should start task and change status from Pending to Processing", () => {
            const { service, expectEvent } = createTestSetup();

            const pendingTask = service.createNewTask(new StepContent("Pending Task"));
            pendingTask.start();

            expect(pendingTask.task.status).toBe(TaskStatus.Processing);
            expect(pendingTask.task.startedAt).toBeDefined();
            expectEvent(TaskServiceEvent.TaskUpdated, pendingTask.task);
        });

        test("should throw error when starting non-pending task", () => {
            const { service, stepOne } = createTestSetup();

            const alreadyStartedTask = service.startNewTask(stepOne);

            expect(() => alreadyStartedTask.start()).toThrow(
                `Cannot start task ${alreadyStartedTask.id} that is not pending`,
            );
        });

        test("wrapper should provide status and completion queries", () => {
            const { service, rootStepContent } = createTestSetup();

            const task = service.createNewTask(rootStepContent);
            expect(task.status).toBe(TaskStatus.Pending);
            expect(task.isFinished).toBe(false);

            task.start();
            expect(task.status).toBe(TaskStatus.Processing);
            expect(task.isFinished).toBe(false);

            task.complete();
            expect(task.status).toBe(TaskStatus.Completed);
            expect(task.isFinished).toBe(true);
        });
    });

    describe("Task Completion Scenarios", () => {
        test("should complete task with default result", () => {
            const { service, rootStepContent, expectEvent } = createTestSetup();

            const rootTask = service.startNewTask(rootStepContent);
            rootTask.complete();

            expect(rootTask.task.finishedAt).toBeDefined();
            expect(rootTask.task.result).toBeInstanceOf(EmptyResult);
            expect(rootTask.task.status).toBe(TaskStatus.Completed);
            expectEvent(TaskServiceEvent.TaskUpdated, rootTask.task);
        });

        test("should complete task with custom result", () => {
            const { service, rootStepContent } = createTestSetup();

            const rootTask = service.startNewTask(rootStepContent);
            const customResult = new TestResult("test data");
            rootTask.complete(customResult);

            expect(rootTask.task.result).toBe(customResult);
        });

        test("should fail task with error", () => {
            const { service, rootStepContent, expectEvent } = createTestSetup();

            const task = service.startNewTask(rootStepContent);
            const error = "Validation failed";
            task.fail(error);

            expect(task.task.finishedAt).toBeDefined();
            expect(task.task.error).toBe(error);
            expect(task.task.result).toBeUndefined();
            expect(task.task.status).toBe(TaskStatus.Failed);
            expectEvent(TaskServiceEvent.TaskUpdated, task.task);
        });

        test("should throw error when completing task with unfinished subtasks", () => {
            const { service, rootStepContent, stepOne } = createTestSetup();

            const parentTask = service.startNewTask(rootStepContent);
            const childTask = parentTask.createSubtask(stepOne);

            expect(() => parentTask.complete()).toThrow(
                `Cannot finish task ${parentTask.id} with unfinished subtasks: ${childTask.id}`,
            );
            expect(() => parentTask.fail("error")).toThrow(
                `Cannot finish task ${parentTask.id} with unfinished subtasks: ${childTask.id}`,
            );
            expect(() => parentTask.cancel()).toThrow(
                `Cannot finish task ${parentTask.id} with unfinished subtasks: ${childTask.id}`,
            );
        });

        test("should throw error when completing non-existent task", () => {
            const { service } = createTestSetup();

            expect(() => service.completeTask("non-existent")).toThrow("Invalid task id: non-existent");
            expect(() => service.failTask("non-existent", "error")).toThrow("Invalid task id: non-existent");
            expect(() => service.cancelTask("non-existent")).toThrow("Invalid task id: non-existent");
        });

        test("should throw error when completing already finished task", () => {
            const { service, rootStepContent } = createTestSetup();

            const completedTask = service.startNewTask(rootStepContent);
            completedTask.complete();

            expect(() => completedTask.complete()).toThrow(`Cannot finish already finished task ${completedTask.id}`);
            expect(() => completedTask.fail("error")).toThrow(
                `Cannot finish already finished task ${completedTask.id}`,
            );
            expect(() => completedTask.cancel()).toThrow(`Cannot finish already finished task ${completedTask.id}`);
        });

        test("should cancel pending and processing tasks", () => {
            const { service, rootStepContent, stepOne, expectEvent } = createTestSetup();

            const pendingTask = service.createNewTask(rootStepContent);
            const processingTask = service.startNewTask(stepOne);

            pendingTask.cancel();
            processingTask.cancel();

            expect(pendingTask.task.status).toBe(TaskStatus.Cancelled);
            expect(pendingTask.task.finishedAt).toBeDefined();
            expect(processingTask.task.status).toBe(TaskStatus.Cancelled);
            expect(processingTask.task.finishedAt).toBeDefined();

            expectEvent(TaskServiceEvent.TaskUpdated, pendingTask.task);
            expectEvent(TaskServiceEvent.TaskUpdated, processingTask.task);
        });

        test("should throw error when completing or failing pending tasks", () => {
            const { service, rootStepContent } = createTestSetup();

            const pendingTask = service.createNewTask(rootStepContent);

            expect(() => pendingTask.complete()).toThrow(
                `Cannot finish pending task ${pendingTask.id} since it is not started`,
            );
            expect(() => pendingTask.fail("error")).toThrow(
                `Cannot finish pending task ${pendingTask.id} since it is not started`,
            );
        });
    });

    describe("Cleanup with Complex Tree Structures", () => {
        test("should cleanup expired tasks and keep active tasks", () => {
            const { service, rootStepContent, stepOne, stepTwo, expectEvent } = createTestSetup();

            const completedRoot = service.startNewTask(rootStepContent);
            const cancelledChild = completedRoot.startSubtask(stepOne);
            cancelledChild.cancel();
            completedRoot.complete();

            const activeRoot = service.startNewTask(stepTwo);

            // Capture task references before cleanup
            const completedRootTask = completedRoot.task;
            const cancelledChildTask = cancelledChild.task;

            vi.setSystemTime(Date.now() + TASK_RETENTION_PERIOD_MS + 1000);

            service.getTasks();

            expect(() => service.getTask(completedRoot.id)).toThrow("Invalid task id");
            expect(() => service.getTask(cancelledChild.id)).toThrow("Invalid task id");
            expect(service.getTask(activeRoot.id)).toBeDefined();
            expectEvent(TaskServiceEvent.TaskDeleted, completedRootTask);
            expectEvent(TaskServiceEvent.TaskDeleted, cancelledChildTask);
        });

        test("should throw error when requesting task that has been deleted", () => {
            const { service, rootStepContent } = createTestSetup();

            const task = service.startNewTask(rootStepContent);
            task.complete();
            vi.setSystemTime(Date.now() + TASK_RETENTION_PERIOD_MS + 1000);

            expect(() => service.getTask(task.id)).toThrow(`Task ${task.id} has been expired`);
        });
    });
    describe("Profile-driven task cleanup", () => {
        test("clears tasks when switching to a different profile", () => {
            const { service, switchToProfile } = createTestSetup();

            switchToProfile("A");
            service.createNewTask(new StepContent("T1"));
            service.createNewTask(new StepContent("T2"));
            expect(service.getTasks().length).toBe(2);

            // Switch to a different profile - should clear
            switchToProfile("B");
            expect(service.getTasks().length).toBe(0);
        });

        test("keeps tasks when switching to the same profile", () => {
          const { service, switchToProfile } = createTestSetup();

          switchToProfile("A");
          service.createNewTask(new StepContent("T1"));
          service.createNewTask(new StepContent("T2"));
          expect(service.getTasks().length).toBe(2);

          // Set to the same profile - no clearing
          switchToProfile("A");
          expect(service.getTasks().length).toBe(2);
        });
      });
});
