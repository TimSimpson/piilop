import { BreadCrumbs, TestMain, TestRegistry, TestObserver, TestStackInfo, TestStatus } from "../../piilop/runner";

export const createSelfTestRegistry = (): TestRegistry => {
    // For the tests, we create a custom registry. Typically a global
    // variable is used everywhere for convenience, but the goal here is to
    // (hopefully) show how this works.
    const registry = new TestRegistry();

    return registry;
};


class SelfTestObserver {
    depth: number;
    log: (message?: any, ...optionalParams: any[])=> void;

    constructor(log?: (message?: any, ...optionalParams: any[])=> void) {
        this.depth = 0;
        this.log = log || console.log;
    }

    breadCrumbsToString(bc?: BreadCrumbs): string {
        if (!bc) {
            return "< no breadcrumbs found >";
        }
        let result = "";
        for (const c of bc) {
            if (result.length == 0) {
                result = c;
            } else {
                result = `${result} -> ${c}`;
            }
        }
        return result;
    }

    public onTestStarted(name: string, _stackInfo: TestStackInfo) {
        this.depth ++;
        this.log(`START ${name}`);
    }

    public onTestFinished(name: string, status: TestStatus, stackInfo: TestStackInfo, err?: unknown) {
        this.log(`FINISH ${name} :: ${status}`);
        if (status === 'failed') {
            this.log(
                `TEST FAILED!\n\ttest: ${this.breadCrumbsToString(stackInfo.breadCrumbs())}\n\terror:${err}`,
            );
        } else if (status === "skipped") {
            this.log(
                `TEST SKIPPED:\n\ttest: ${this.breadCrumbsToString(stackInfo.breadCrumbs())}`,
            );
        }
        this.depth --;
    }
}

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
            const observer = new SelfTestObserver(pushLogs);
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
