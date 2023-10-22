// TODO (tss): I'm going to bust this into different files, but initially it
// has been easier to keep everything here. For a summary of what's exported,
// see "./index.ts"
import * as core from "../core";

import { randomName } from "./misc";

export { Priority } from "../core/registry";

export class ResourceManager<
    D extends core.Data & CreateOptions,
    CreateOptions
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

    public breadCrumbs(): string {
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
    onTestFinished: (n: string, t: TestStatus) => void;
    onTestStarted: (n: string) => void;
    logs: string[];
    thread: TestStack;

    constructor(
        onTestStarted: (n: string) => void,
        onTestFinished: (n: string, t: TestStatus) => void
    ) {
        this.thread = new TestStack();
        this.logs = [];
        this.onTestFinished = onTestFinished;
        this.onTestStarted = onTestStarted;
    }

    public createArbitraryName(): string {
        return randomName();
    }
}

export class TestContext {
    defered: Function[];
    opts: TestContextOpts;

    constructor(opts: TestContextOpts) {
        this.opts = opts;
        this.defered = [];
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
    public log(msg: string) {
        this.opts.logs.push(msg);
    }

    public async run<R>(
        testName: string,
        testFunc: core.TestContextFunc<TestContext, R, any>
    ): Promise<R> {
        this.opts.thread.startTest(testName);
        this.opts.onTestStarted(testName);
        const stackDepth = this.opts.thread.currentDepth();
        try {
            const result = await testFunc(this);
            this.opts.thread.finishTest(testName, "passed");
            this.opts.onTestFinished(testName, "passed");
            return result;
        } catch (err) {
            if (stackDepth == this.opts.thread.currentDepth()) {
                this.log(
                    `TEST FAILED!\n\ttest: ${this.opts.thread.breadCrumbs()}\n\terror:${err}`
                );
                this.opts.thread.finishTest(testName, "failed");
                this.opts.onTestFinished(testName, "failed");
            } else {
                this.log(
                    `TEST SKIPPED:\n\ttest: ${this.opts.thread.breadCrumbs()}`
                );
                this.opts.thread.finishTest(testName, "skipped");
                this.opts.onTestFinished(testName, "skipped");
            }
            throw err;
        }
    }
}

export class TestContextFrame extends TestContext {
    parent: TestContext;
    testName: string;

    constructor(parent: TestContext, testName: string) {
        super(parent.opts);
        this.parent = parent;
        this.testName = testName;

        // only announce tests if the functions aren't aliases of each other
        if (this.parent.currentTestName() != testName) {
            this.opts.thread.startTest(testName);
            this.opts.onTestStarted(testName);
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
            this.opts.thread.finishTest(this.testName, "passed");
            this.opts.onTestFinished(this.testName, "passed");
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

export class TestMain {
    ctx: TestContext;
    list: TestRunnerItem[];
    registry: TestRegistry;
    depth: number;

    constructor(registry: TestRegistry) {
        this.registry = registry;
        this.list = core.createRunnerList<TestContext, TestRunnerItem>(
            registry.getEntries(),
            createTestRunnerItem
        );
        const opts = new TestContextOpts(
            (name) => this.startTest(name),
            (n, s) => this.finishTest(n, s)
        );
        this.ctx = new TestContext(opts);
        this.depth = 1;
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
            createTestRunnerItem
        );

        let workLeft: core.TestRunnerItem<TestContext>[] = [];
        for (const entry of list) {
            if (entry.entry.name.startsWith(name)) {
                workLeft.push(entry);
                // await entry.entry.func(this.ctx);
            }
        }

        workLeft.reverse();

        const workers =  [];
        workerCount = workerCount || 1;
        if (workerCount != undefined && workerCount > 0) {

            console.log("MARIO 0")

            const workerLogic = async () => {
                await (async () => {})();
                console.log("MARIO a")
                while (workLeft.length > 0) {
                    console.log("MARIO h")
                    const nextEntry = workLeft.pop();
                    await nextEntry?.entry.func(this.ctx);
                    console.log("MARIO it got awaited?");
                }
                console.log("MARIO all done")
            };

            workers.push(workerLogic());
        }

        console.log("MARIO Ok now I done");
        await Promise.all(workers);

        // for (const entry of list) {
        //     if (entry.entry.name.startsWith(name)) {
        //         await entry.entry.func(this.ctx);
        //     }
        // }
        console.log("Done");
    }

    public showTestList(shower?: (msg: string) => void) {
        if (shower === undefined) {
            shower = (msg: string) => {
                console.log(msg);
            };
        }
        const list = core.createRunnerList(
            this.registry.getEntries(),
            createTestRunnerItem
        );
        for (const entry of list) {
            shower(`${entry.entry.name}`);
        }
    }
}
