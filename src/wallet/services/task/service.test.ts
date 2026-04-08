import { expect, test, vi, describe } from "vitest"
import { ServiceCollection } from "@/wallet/base"
import { DummyLogger } from "@/wallet/logger"
import { ProfileInfo, ProfileService } from "@/wallet/services/profile/service"
import { OriginType, TxOrigin } from "@/wallet/services/transaction/client"
import { EventHandler } from "@/wallet/utils/event-handler"
import {
	TaskService,
	TASK_RETENTION_PERIOD_MS,
	StepContent,
	TaskStatus,
	ContentKind,
	EmptyResult,
	ITaskResult,
	ResultKind,
	Events,
} from "./service"

class TestResult implements ITaskResult {
	public readonly kind = ResultKind.Empty
	constructor(public readonly testData: string) {}
}

const createTestSetup = async () => {
	const profileServiceMock = {
		name: ProfileService.name,
		onActiveProfileChanged: new EventHandler<ProfileInfo>(),
		start: vi.fn(),
	} as unknown as ProfileService

	const taskService = new TaskService(new DummyLogger())
	const onTaskCreatedMock = vi.fn()
	taskService.onTaskCreated.add(onTaskCreatedMock)
	const onTaskDeletedMock = vi.fn()
	taskService.onTaskDeleted.add(onTaskDeletedMock)
	const onTaskUpdatedMock = vi.fn()
	taskService.onTaskUpdated.add(onTaskUpdatedMock)

	const services = new ServiceCollection()
	services.add(profileServiceMock)
	services.add(taskService)
	await services.start()

	const rootStepContent = new StepContent("Root Task")
	const stepOne = new StepContent("Step One", 1000)
	const stepTwo = new StepContent("Step Two", 2000)

	const expectEvent = <T extends keyof Events>(event: T, payload: Events[T]) => {
		switch (event) {
			case "onTaskCreated":
				expect(onTaskCreatedMock).toHaveBeenCalledWith(payload)
				break
			case "onTaskDeleted":
				expect(onTaskDeletedMock).toHaveBeenCalledWith(payload)
				break
			case "onTaskUpdated":
				expect(onTaskUpdatedMock).toHaveBeenCalledWith(payload)
				break
			default:
				throw new Error("Invalid event")
		}
	}

	const switchToProfile = (profile?: ProfileInfo) => {
		profileServiceMock.onActiveProfileChanged.invoke(profile)
	}

	return {
		service: taskService,
		rootStepContent,
		stepOne,
		stepTwo,
		expectEvent,
		switchToProfile,
	}
}

describe("Task Tree Implementation", () => {
	describe("Task Creation and Structure", () => {
		test("should create pending root task", async () => {
			const { service, rootStepContent, expectEvent } = await createTestSetup()

			const pendingTask = service.createNewTask(rootStepContent)

			expect(pendingTask.task.parentId).toBeUndefined()
			expect(pendingTask.task.content.kind).toBe(ContentKind.Step)
			expect(pendingTask.task.status).toBe(TaskStatus.Pending)
			expect(pendingTask.task.startedAt).toBeUndefined()
			expectEvent("onTaskCreated", pendingTask.task)
		})

		test("should create processing root task", async () => {
			const { service, rootStepContent, expectEvent } = await createTestSetup()

			const processingTask = service.startNewTask(rootStepContent)

			expect(processingTask.task.status).toBe(TaskStatus.Processing)
			expect(processingTask.task.startedAt).toBeDefined()
			expect(processingTask.task.startedAt).toBeGreaterThanOrEqual(processingTask.task.createdAt)
			expectEvent("onTaskCreated", processingTask.task)
		})

		test("should create subtasks and maintain parent-child relationships", async () => {
			const { service, rootStepContent, stepOne, stepTwo, expectEvent } = await createTestSetup()

			const parentTask = service.createNewTask(rootStepContent)
			const childOne = parentTask.createSubtask(stepOne)
			const childTwo = parentTask.createSubtask(stepTwo)

			expect(childOne.task.parentId).toBe(parentTask.task.id)
			expect(childTwo.task.parentId).toBe(parentTask.task.id)
			expect(parentTask.task.subtasks).toHaveLength(2)
			expect(parentTask.task.subtasks).toContainEqual(childOne.task)
			expect(parentTask.task.subtasks).toContainEqual(childTwo.task)

			expectEvent("onTaskCreated", childOne.task)
			expectEvent("onTaskCreated", childTwo.task)
			expectEvent("onTaskUpdated", parentTask.task)
		})

		test("should handle creation errors", async () => {
			const { service, rootStepContent, stepOne } = await createTestSetup()

			const completedParent = service.startNewTask(rootStepContent)
			completedParent.complete()

			expect(() => service.createNewTask(stepOne, completedParent.id)).toThrow(
				`Cannot add task to finished parent ${completedParent.id}`,
			)

			expect(() => service.createNewTask(stepOne, "non-existent")).toThrow("Invalid task id: non-existent")
		})

		test("should return root tasks from getTasks", async () => {
			const { service } = await createTestSetup()

			const rootTask = service.createNewTask(new StepContent("Root"))
			rootTask.createSubtask(new StepContent("Step One"))
			const stepTwoTask = rootTask.createSubtask(new StepContent("Step Two"))
			stepTwoTask.createSubtask(new StepContent("Step Two A"))

			const rootTasks = await service.getTasks()

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
			])
		})

		test("should propagate origin to subtasks", async () => {
			const { service } = await createTestSetup()
			const origin: TxOrigin = { type: OriginType.UI }

			const rootTask = service.createNewTask(new StepContent("Root"), undefined, origin)
			const subtask = rootTask.createSubtask(new StepContent("Subtask"))

			expect(rootTask.origin).toBe(origin)
			expect(subtask.origin).toBe(origin)
			expect(subtask.task.origin).toBe(origin)
		})
	})

	describe("Task Status Management", () => {
		test("should start task and change status from Pending to Processing", async () => {
			const { service, expectEvent } = await createTestSetup()

			const pendingTask = service.createNewTask(new StepContent("Pending Task"))
			pendingTask.start()

			expect(pendingTask.task.status).toBe(TaskStatus.Processing)
			expect(pendingTask.task.startedAt).toBeDefined()
			expectEvent("onTaskUpdated", pendingTask.task)
		})

		test("should throw error when starting non-pending task", async () => {
			const { service, stepOne } = await createTestSetup()

			const alreadyStartedTask = service.startNewTask(stepOne)

			expect(() => alreadyStartedTask.start()).toThrow(`Cannot start task ${alreadyStartedTask.id} that is not pending`)
		})

		test("wrapper should provide status and completion queries", async () => {
			const { service, rootStepContent } = await createTestSetup()

			const task = service.createNewTask(rootStepContent)
			expect(task.status).toBe(TaskStatus.Pending)
			expect(task.isFinished).toBe(false)

			task.start()
			expect(task.status).toBe(TaskStatus.Processing)
			expect(task.isFinished).toBe(false)

			task.complete()
			expect(task.status).toBe(TaskStatus.Completed)
			expect(task.isFinished).toBe(true)
		})
	})

	describe("Task Completion Scenarios", () => {
		test("should complete task with default result", async () => {
			const { service, rootStepContent, expectEvent } = await createTestSetup()

			const rootTask = service.startNewTask(rootStepContent)
			rootTask.complete()

			expect(rootTask.task.finishedAt).toBeDefined()
			expect(rootTask.task.result).toBeInstanceOf(EmptyResult)
			expect(rootTask.task.status).toBe(TaskStatus.Completed)
			expectEvent("onTaskUpdated", rootTask.task)
		})

		test("should complete task with custom result", async () => {
			const { service, rootStepContent } = await createTestSetup()

			const rootTask = service.startNewTask(rootStepContent)
			const customResult = new TestResult("test data")
			rootTask.complete(customResult)

			expect(rootTask.task.result).toBe(customResult)
		})

		test("should fail task with error", async () => {
			const { service, rootStepContent, expectEvent } = await createTestSetup()

			const task = service.startNewTask(rootStepContent)
			const error = "Validation failed"
			task.fail(error)

			expect(task.task.finishedAt).toBeDefined()
			expect(task.task.error).toBe(error)
			expect(task.task.result).toBeUndefined()
			expect(task.task.status).toBe(TaskStatus.Failed)
			expectEvent("onTaskUpdated", task.task)
		})

		test("should throw error when completing task with unfinished subtasks", async () => {
			const { service, rootStepContent, stepOne } = await createTestSetup()

			const parentTask = service.startNewTask(rootStepContent)
			const childTask = parentTask.createSubtask(stepOne)

			expect(() => parentTask.complete()).toThrow(`Cannot finish task ${parentTask.id} with unfinished subtasks: ${childTask.id}`)
			expect(() => parentTask.fail("error")).toThrow(`Cannot finish task ${parentTask.id} with unfinished subtasks: ${childTask.id}`)
			expect(() => parentTask.cancel()).toThrow(`Cannot finish task ${parentTask.id} with unfinished subtasks: ${childTask.id}`)
		})

		test("should throw error when completing non-existent task", async () => {
			const { service } = await createTestSetup()

			expect(() => service.completeTask("non-existent")).toThrow("Invalid task id: non-existent")
			expect(() => service.failTask("non-existent", "error")).toThrow("Invalid task id: non-existent")
			expect(() => service.cancelTask("non-existent")).toThrow("Invalid task id: non-existent")
		})

		test("should throw error when completing already finished task", async () => {
			const { service, rootStepContent } = await createTestSetup()

			const completedTask = service.startNewTask(rootStepContent)
			completedTask.complete()

			expect(() => completedTask.complete()).toThrow(`Cannot finish already finished task ${completedTask.id}`)
			expect(() => completedTask.fail("error")).toThrow(`Cannot finish already finished task ${completedTask.id}`)
			expect(() => completedTask.cancel()).toThrow(`Cannot finish already finished task ${completedTask.id}`)
		})

		test("should cancel pending and processing tasks", async () => {
			const { service, rootStepContent, stepOne, expectEvent } = await createTestSetup()

			const pendingTask = service.createNewTask(rootStepContent)
			const processingTask = service.startNewTask(stepOne)

			pendingTask.cancel()
			processingTask.cancel()

			expect(pendingTask.task.status).toBe(TaskStatus.Cancelled)
			expect(pendingTask.task.finishedAt).toBeDefined()
			expect(processingTask.task.status).toBe(TaskStatus.Cancelled)
			expect(processingTask.task.finishedAt).toBeDefined()

			expectEvent("onTaskUpdated", pendingTask.task)
			expectEvent("onTaskUpdated", processingTask.task)
		})

		test("should throw error when completing or failing pending tasks", async () => {
			const { service, rootStepContent } = await createTestSetup()

			const pendingTask = service.createNewTask(rootStepContent)

			expect(() => pendingTask.complete()).toThrow(`Cannot finish pending task ${pendingTask.id} since it is not started`)
			expect(() => pendingTask.fail("error")).toThrow(`Cannot finish pending task ${pendingTask.id} since it is not started`)
		})
	})

	describe("Cleanup with Complex Tree Structures", () => {
		test("should cleanup expired tasks and keep active tasks", async () => {
			const { service, rootStepContent, stepOne, stepTwo, expectEvent } = await createTestSetup()

			const completedRoot = service.startNewTask(rootStepContent)
			const cancelledChild = completedRoot.startSubtask(stepOne)
			cancelledChild.cancel()
			completedRoot.complete()

			const activeRoot = service.startNewTask(stepTwo)

			// Capture task references before cleanup
			const completedRootTask = completedRoot.task
			const cancelledChildTask = cancelledChild.task

			vi.setSystemTime(Date.now() + TASK_RETENTION_PERIOD_MS + 1000)

			await service.getTasks()

			expect(() => service.getTaskSync(completedRoot.id)).toThrow("Invalid task id")
			expect(() => service.getTaskSync(cancelledChild.id)).toThrow("Invalid task id")
			expect(service.getTaskSync(activeRoot.id)).toBeDefined()
			expectEvent("onTaskDeleted", completedRootTask)
			expectEvent("onTaskDeleted", cancelledChildTask)
		})

		test("should throw error when requesting task that has been deleted", async () => {
			const { service, rootStepContent } = await createTestSetup()

			const task = service.startNewTask(rootStepContent)
			task.complete()
			vi.setSystemTime(Date.now() + TASK_RETENTION_PERIOD_MS + 1000)

			expect(() => service.getTaskSync(task.id)).toThrow(`Task ${task.id} has been expired`)
		})
	})
	describe("Profile-driven task cleanup", () => {
		test("clears tasks when switching to a different profile", async () => {
			const { service, switchToProfile } = await createTestSetup()

			switchToProfile({ id: "A", name: "A", type: "password" })
			service.createNewTask(new StepContent("T1"))
			service.createNewTask(new StepContent("T2"))
			expect((await service.getTasks()).length).toBe(2)

			// Switch to a different profile - should clear
			switchToProfile({ id: "B", name: "B", type: "password" })
			expect((await service.getTasks()).length).toBe(0)
		})

		test("keeps tasks when switching to the same profile", async () => {
			const { service, switchToProfile } = await createTestSetup()

			switchToProfile({ id: "A", name: "A", type: "password" })
			service.createNewTask(new StepContent("T1"))
			service.createNewTask(new StepContent("T2"))
			expect((await service.getTasks()).length).toBe(2)

			// Set to the same profile - no clearing
			switchToProfile({ id: "A", name: "A", type: "password" })
			expect((await service.getTasks()).length).toBe(2)
		})
	})
})
