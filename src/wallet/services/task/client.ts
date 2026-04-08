import type { ServiceSpec } from "@/wallet/base"
import { ServiceClient } from "@/wallet/base/background"
import { LoggerServiceClient } from "@/wallet/services/logger/client"
import { EventHandler } from "@/wallet/utils/event-handler"
import { type Events, type Methods, type Task, TASK_SERVICE_NAME } from "./spec"

export * from "./spec"

export class TaskServiceClient extends ServiceClient<Methods, Events> implements ServiceSpec<Methods, Events> {
	public readonly onTaskCreated = new EventHandler<Task>()
	public readonly onTaskUpdated = new EventHandler<Task>()
	public readonly onTaskDeleted = new EventHandler<Task>()

	public constructor(name?: string) {
		super(TASK_SERVICE_NAME, new LoggerServiceClient(), name)
	}

	public getTask(id: string): Promise<Task> {
		return this.request("getTask", id)
	}

	getTasks(): Promise<Task[]> {
		return this.request("getTasks")
	}
}
