import { TestMain, TestRegistry, DefaultTestObserver, TestObserver } from "../../naf/runner";

export const createSelfTestRegistry = (): TestRegistry => {
    // For the tests, we create a custom registry. Typically a global
    // variable is used everywhere for convenience, but the goal here is to
    // (hopefully) show how this works.
    const registry = new TestRegistry();

    return registry;
};

export class   SelfTestMonitor  {
    incrementingNameIndex: number;
    logs: string[]


    constructor() {
        this.incrementingNameIndex = 0;
        this.logs = [];
    }

    createArbitraryName(): string {
        return `TN-${this.incrementingNameIndex++}`;
    }

    observerFactory(): () => TestObserver {
        const self = this;
        const pushLogs = (message?: any) => { self.log(message); }
        const factory = () : TestObserver => {
            const observer = new DefaultTestObserver(pushLogs);
            observer.createPrefix = () => "";
            return observer;
        }
        return factory;
    }

    getLogs(): string[] {
        return this.logs;
    }

    log(message?: any) {
        this.logs.push(message);
    }

    logWriter(): (message?: any) => void {
        const self = this;
        return (message?: any) => { self.log(message); };
    }
}

// creates a new "main", runs the tests, and returns the ctx logs
export const runTests = async (
    monitor: SelfTestMonitor,
    registry: TestRegistry,
    test?: string,
): Promise<string[]> => {
    const main = new TestMain(registry, monitor.observerFactory());
    await main.runTest(test);
    return monitor.getLogs();
};

export const createTestList = (registry: TestRegistry): string[] => {
    const list: string[] = [];
    const monitor = new SelfTestMonitor();
    const main = new TestMain(registry, monitor.observerFactory());
    main.showTestList((s) => list.push(s));
    return list;
};

export const getResourceInfo = (registry: TestRegistry): string => {
    const info: string[] = [];
    registry.getResourceManager().info((msg: string) => info.push(msg));
    return info.join("\n");
};
