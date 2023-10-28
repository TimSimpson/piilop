// TODO (tss): I'm going to bust this into different files, but initially it
// has been easier to keep everything here. For a summary of what's exported,
// see "./index.ts"
import * as core from "../core";

import { randomName } from "./misc";

export { Priority } from "../core/registry";

export class ResourceManager<
    D extends core.Data & CreateOptions,
    CreateOptions,
> extends core.ResourceManager<TestContext, D, CreateOptions> {}
export class TestRegistry extends core.TestRegistry<TestContext> {}

export type TestStatus = "passed" | "failed" | "skipped";

export type TestEntry = core.TestEntry<TestContext, any>;

type TestStackItem =
    | { testName: string; type: "started" }
    | { testName: string; type: "finished"; status: TestStatus }
    | { type: "spawn"; childName: string; testName: null };

// yes, I know these aren't really threads
let threadCount = 0;

export type TestStackInfo = {
    breadCrumbs: () => BreadCrumbs,
    currentDepth: () => number,
    currentTestName: () => string | null,
};

class TestStack {
    depth: number;
    items: TestStackItem[];
    name: string;
    parent: TestStack | null;

    constructor() {
        this.parent = null;
        this.items = [];
        this.name = `t-${threadCount}`;
        this.depth = 0;
        threadCount += 1;
    }

    public breadCrumbs(): BreadCrumbs {
        const bc = [];
        for (const item of this.items) {
            if (item.type == "started") {
                bc.push(item.testName);
            } else if (item.type == "finished") {
                if (bc[bc.length - 1] == item.testName) {
                    bc.pop();
                }
            }
        }
        return bc;
    }

    public currentDepth(): number {
        return this.items.length;
    }

    public currentTestName(): string | null {
        return this.items[this.items.length - 1].testName;
    }

    public startChild(): TestStack {
        const child = new TestStack();
        child.parent = this;
        this.items.push({
            type: "spawn",
            childName: child.name,
            testName: null,
        });
        return child;
    }

    public startTest(testName: string) {
        this.items.push({ testName, type: "started" });
        this.depth += 1;
    }

    public finishTest(testName: string, status: TestStatus) {
        this.items.push({ testName, type: "finished", status });
        this.depth -= 1;
    }
}

export class TestContextOpts {
    logs: string[];

    constructor(        ) {
        this.logs = [];
    }

    public createArbitraryName(): string {
        return randomName();
    }
}

export class TestContext {
    defered: Function[];
    observer: TestObserver;
    opts: TestContextOpts;
    thread: TestStack;

    constructor(thread: TestStack, opts: TestContextOpts, observer: TestObserver) {
        this.observer = observer;
        this.opts = opts;
        this.defered = [];
        this.thread = thread;
    }

    public currentTestName(): string | null {
        return null;
    }

    public begin(args: core.TestContextPushArgs): TestContext {
        return new TestContextFrame(this, args.name);
    }

    protected cleanUp() {
        for (const d of this.defered) {
            d();
        }
    }

    public createArbitraryName(): string {
        return this.opts.createArbitraryName();
    }

    // schedules a clean up task to run in the _parent_ context
    public defer(_caller: number, f: Function) {
        this.defered.push(f);
    }

    public end(): TestContext {
        this.cleanUp();
        throw new Error("TestContext stack empty");
    }

    public getLogs(): string[] {
        return this.opts.logs;
    }

    // Logs some stuff. This is mainly used by NAF when it tests itself.
    // public log(msg: string) {
    //     this.opts.logs.push(msg);
    // }

    public async run<R>(
        testName: string,
        testFunc: core.TestContextFunc<TestContext, R, any>,
    ): Promise<R> {
        this.thread.startTest(testName);
        this.observer.onTestStarted(testName, this.thread);
        const stackDepth = this.thread.currentDepth();
        try {
            const result = await testFunc(this);
            this.thread.finishTest(testName, "passed");
            this.observer.onTestFinished(testName, "passed", this.thread);
            return result;
        } catch (err) {
            if (stackDepth == this.thread.currentDepth()) {
                // this.log(
                //     `TEST FAILED!\n\ttest: ${this.thread.breadCrumbs()}\n\terror:${err}`,
                // );
                this.thread.finishTest(testName, "failed");
                this.observer.onTestFinished(testName, "failed", this.thread, err);
            } else {
                // this.log(
                //     `TEST SKIPPED:\n\ttest: ${this.thread.breadCrumbs()}`,
                // );
                this.thread.finishTest(testName, "skipped");
                this.observer.onTestFinished(testName, "skipped", this.thread);
            }
            throw err;
        }
    }
}

export class TestContextFrame extends TestContext {
    parent: TestContext;
    testName: string;

    constructor(parent: TestContext, testName: string) {
        super(parent.thread, parent.opts, parent.observer);
        this.parent = parent;
        this.testName = testName;

        // only announce tests if the functions aren't aliases of each other
        if (this.parent.currentTestName() != testName) {
            this.thread.startTest(testName);
            this.observer.onTestStarted(testName, this.thread);
        }
    }

    public begin(args: core.TestContextPushArgs): TestContextFrame {
        return new TestContextFrame(this, args.name);
    }

    public currentTestName(): string | null {
        return this.testName;
    }

    public defer(caller: number, f: Function) {
        if (caller > 0) {
            this.parent.defer(caller - 1, f);
        } else {
            this.defered.push(f);
        }
    }

    public end(): TestContext {
        if (this.parent.currentTestName() != this.testName) {
            this.thread.finishTest(this.testName, "passed");
            this.observer.onTestFinished(this.testName, "passed", this.thread);
        }
        this.cleanUp();
        return this.parent;
    }
}

export interface TestRunnerItem {
    entry: TestEntry;
    status: TestStatus | null | "running";
    dependents: TestRunnerItem[];
    dependsOn: TestRunnerItem[];
}

const createTestRunnerItem = (entry: TestEntry) => {
    return {
        dependents: [],
        dependsOn: [],
        entry,
        status: null,
    };
};

export type BreadCrumbs = string[];

export type TestObserver = {
    onTestFinished: (name: string, status: TestStatus, stackInfo: TestStackInfo, err?: unknown) => void;
    onTestStarted: (name: string, stackInfo: TestStackInfo) => void;
};


export class DefaultTestObserver {
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

    createPrefix(): string {
        return "  • ".repeat(this.depth);
    }

    public onTestStarted(name: string, _stackInfo: TestStackInfo) {
        this.depth ++;
        const prefix = this.createPrefix();
        this.log(`${prefix}START ${name}`);
    }

    public onTestFinished(name: string, status: TestStatus, stackInfo: TestStackInfo, err?: unknown) {
        const prefix = this.createPrefix();
        this.log(`${prefix}FINISH ${name} :: ${status}`);
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

export class TestMain {
    list: TestRunnerItem[];
    registry: TestRegistry;
    depth: number;
    observerFactory: () => TestObserver;

    constructor(registry: TestRegistry, observerFactory?: () => TestObserver) {
        this.registry = registry;
        this.list = core.createRunnerList<TestContext, TestRunnerItem>(
            registry.getEntries(),
            createTestRunnerItem,
        );
        this.depth = 1;
        this.observerFactory = observerFactory || (() => new DefaultTestObserver());
    }

    newContext(): TestContext {
        const opts = new TestContextOpts();
        const thread = new TestStack();
        const observer = this.observerFactory();
        return new TestContext(thread, opts, observer);
    }

    startTest(name: String) {
        const prefix = "  • ".repeat(this.depth);
        console.log(`${prefix}${name} :{`);
        this.depth++;
    }

    finishTest(name: String, status: TestStatus) {
        this.depth--;
        const prefix = "  • ".repeat(this.depth);
        console.log(`${prefix} ${name} :: ${status}`);
    }

    public async runTest(name?: string, workerCount?: number) {
        name = name || "";

        if (name == "all") {
            name = "";
        }

        const list: core.TestRunnerItem<TestContext>[] = core.createRunnerList(
            this.registry.getEntries(),
            createTestRunnerItem,
        );

        const parallel = false;

        if (parallel) {
            let workLeft: core.TestRunnerItem<TestContext>[] = [];
            for (const entry of list) {
                if (entry.entry.name.startsWith(name)) {
                    workLeft.push(entry);
                    // await entry.entry.func(this.ctx);
                }
            }

            workLeft.reverse();

            const workers: Promise<void>[] = [];
            workerCount = workerCount || 1;
            for (let i = 0; i < workerCount; i++) {
                const workerCtx = this.newContext();
                const workerLogic = async () => {
                    await (async () => {})();
                    while (workLeft.length > 0) {
                        const nextEntry = workLeft.pop();
                        await nextEntry?.entry.func(workerCtx);
                    }
                };

                workers.push(workerLogic());
            }

            await Promise.all(workers);
        } else {
            const workerCtx = this.newContext();
            for (const entry of list) {
                if (entry.entry.name.startsWith(name)) {
                    await entry.entry.func(workerCtx);
                }
            }
        }
    }

    public showTestList(shower?: (msg: string) => void) {
        if (shower === undefined) {
            shower = (msg: string) => {
                console.log(msg);
            };
        }
        const list = core.createRunnerList(
            this.registry.getEntries(),
            createTestRunnerItem,
        );
        for (const entry of list) {
            shower(`${entry.entry.name}`);
        }
    }
}
