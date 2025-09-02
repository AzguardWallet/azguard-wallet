import { EventHandler } from "@/wallet/utils/event-handler";

export type EventsMap = Record<string, unknown>;

export type EventsSpec<T extends EventsMap> = {
    [P in keyof T]: EventHandler<T[P]>;
};
export type MethodsMap = Record<string, (...params: any) => unknown>;

export type MethodsSpec<T extends MethodsMap> = {
    [M in keyof T]: (...params: Parameters<T[M]>) => Promise<ReturnType<T[M]>>;
};

export type ServiceSpec<T1 extends MethodsMap, T2 extends EventsMap = {}> = MethodsSpec<T1> & EventsSpec<T2>;

export interface IService {
    name: string;
    start(services: ServiceCollection): Promise<void>;
}

export class ServiceCollection {
    private readonly services = new Map<string, IService>();

    public add(service: IService) {
        if (this.services.has(service.name)) {
            throw new Error(`Service '${service.name}' has already been registered`);
        }
        this.services.set(service.name, service);
    }

    public get<T extends IService>(name: string): T {
        const service = this.services.get(name);
        if (!service) {
            throw new Error(`Service '${name}' hasn't been registered`);
        }
        return service as T;
    }

    public async start() {
        await Promise.all(this.services.values().map(x => x.start(this)));
    }
}
