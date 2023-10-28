import { ITestContext, TestContextFunc, wrap } from "./base";
import { objectIsSubsetOf } from "./objectEquality";
import {
    Data,
    ResourceManager,
    ResourceManagerRegistry,
    StateCreator,
    StateDeleter,
} from "./resources";

/**
 * A test func is like the TestContextFunc but only takes a TestContext as an
 * argument, which allows it to be called by the test runner code.
 */
export type TestFunc<C extends ITestContext, R> = TestContextFunc<C, R, []>;

export enum Priority {
    First = 0,
    Normal = 50,
    Last = 100,
}

/** This represents a runnable test */
export interface TestEntry<C extends ITestContext, R> {
    name: string;
    suite: string;
    func: TestFunc<C, R>;
    dependsOn: string[];
    priority: Priority;
}

/** This represents the entire suite of tests. It also registers ResourceManagers,
 *  and creates extra tests which simply call them.
 */
export class TestRegistry<Ctx extends ITestContext> {
    entries: TestEntry<Ctx, any>[];
    names: string[];
    resources: ResourceManagerRegistry<Ctx>;

    constructor() {
        this.entries = [];
        this.names = [];
        this.resources = new ResourceManagerRegistry();
    }

    public find(name: string): TestEntry<Ctx, any> | null {
        for (const entry of this.entries) {
            if (entry.name == name) {
                return entry;
            }
        }
        return null;
    }

    public getEntries(): TestEntry<Ctx, any>[] {
        return this.entries;
    }

    public getResourceManager(): ResourceManagerRegistry<Ctx> {
        return this.resources;
    }

    public newResourceRegistry<D extends Data & C, C>(
        resourceName: string,
    ): ResourceManager<Ctx, D, C> {
        return this.resources.new<D, C>(resourceName);
    }

    // TODO(tss): Remove this function! Instead rely on `registerCreateTests` and `registerDeleteTests` in the Register
    public newResourceManager<D extends Data & C, C>(args: {
        resourceName: string;
        dependsOn: string[];
        create: {
            testName: (arg: C) => string;
            testCases: C[];
            func: StateCreator<Ctx, D, C>;
        };
        delete: {
            testName: (arg: C) => string;
            testCases: C[];
            func: StateDeleter<Ctx, D>;
        };
    }): ResourceManager<Ctx, D, C> {
        const rm = this.resources.new<D, C>(args.resourceName);

        {
            const originalFunc = args.create.func;
            rm.registerWrappedCreateFunc(
                args.create.testName,
                args.create.func,
            );
            for (const testCaseArgs of args.create.testCases) {
                const func = async (ctx: Ctx) => {
                    await rm.createInternal(
                        ctx,
                        testCaseArgs,
                        (_) => {},
                        originalFunc,
                    );
                };
                const entry: TestEntry<Ctx, any> = {
                    dependsOn: args.dependsOn,
                    func,
                    name: args.create.testName(testCaseArgs),
                    priority: Priority.Normal, // TODO(tss): should be Priority.First?
                    suite: args.resourceName,
                };
                this.register(entry);
            }
        }

        {
            rm.registerDeleteFunc(args.delete.func);
            for (const testCaseArgs of args.delete.testCases) {
                const func = async (ctx: Ctx) => {
                    await rm.findDataAndCall(
                        {
                            createArgs: testCaseArgs,
                            searchState: (state) =>
                                state.dependents.length == 0 &&
                                state.lockedBy == null &&
                                state.data &&
                                objectIsSubsetOf(
                                    testCaseArgs as any,
                                    state.data as any,
                                ),
                        },
                        ctx,
                        async (data) => await rm.delete(ctx, data),
                    );
                };
                const entry: TestEntry<Ctx, any> = {
                    dependsOn: args.dependsOn,
                    func,
                    name: args.delete.testName(testCaseArgs),
                    priority: Priority.Last,
                    suite: args.resourceName,
                };
                this.register(entry);
            }
        }

        return rm;
    }

    public showEntries(shower?: (msg: string) => void) {
        if (shower === undefined) {
            shower = (msg: string) => {
                console.log(msg);
            };
        }
        for (const entry of this.entries) {
            shower(`${entry.name}\n\tpriority: ${entry.priority}`);
        }
    }

    // Registers a single test
    public register(entry: TestEntry<Ctx, any>): TestEntry<Ctx, any> {
        this.registerUnwrapped(entry);
        const originalFunc = entry.func;
        const wrappedFunc = wrap(originalFunc, { name: entry.name });
        // const wrappedFunc = async (ctx: TestContext) => {
        //     return ctx.run(entry.name, originalFunc);
        // };
        entry.func = wrappedFunc;
        return entry;
    }

    /**
     * Given a resource manager, registers a set of create tests.
     * These tests just pass different create options to the resource manager.
     */
    public registerCreateTests<D extends Data & CreateOptions, CreateOptions>(
        resourceManager: ResourceManager<Ctx, D, CreateOptions>,
        nameFunc: (arg: CreateOptions) => string,
        dependsOn: string[],
        priority: Priority,
        suite: string,
        ...opts: CreateOptions[]
    ) {
        for (const opt of opts) {
            const name = nameFunc(opt);
            const func = async (ctx: Ctx) => {
                await resourceManager.create(ctx, opt, (_) => {});
            };
            this.register({
                dependsOn,
                func,
                name,
                priority,
                suite,
            });
        }
    }

    /** Given a resource manager, registers a set of delete tests.
     * These tests just pass different create options to the resource manager.
     * NOTE: The DSL passes `Priority.Last` here, which is what you want most
     * of the time.
     */
    public registerDeleteTests<D extends Data & CreateOptions, CreateOptions>(
        resourceManager: ResourceManager<Ctx, D, CreateOptions>,
        nameFunc: (arg: CreateOptions) => string,
        dependsOn: string[],
        priority: Priority,
        suite: string,
        ...opts: CreateOptions[]
    ) {
        for (const opt of opts) {
            const name = nameFunc(opt);
            const func = async (ctx: Ctx) => {
                await resourceManager.findDataAndCall(
                    {
                        createArgs: opt,
                        searchState: (state) =>
                            state.dependents.length == 0 &&
                            state.lockedBy == null &&
                            state.data &&
                            objectIsSubsetOf(opt as any, state.data as any),
                    },
                    ctx,
                    async (data) => await resourceManager.delete(ctx, data),
                );
            };
            this.register({
                dependsOn,
                func,
                name,
                priority,
                suite,
            });
        }
    }

    private registerUnwrapped(entry: TestEntry<Ctx, any>): TestEntry<Ctx, any> {
        for (const n of this.names) {
            if (entry.name == n) {
                throw new Error(`duplicate test names not allowed: "${n}"`);
            }
        }
        this.names.push(entry.name);
        this.entries.push(entry);
        return entry;
    }
}
