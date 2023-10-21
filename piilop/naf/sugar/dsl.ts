import * as runner from "../runner";

// type fnCreate = <Data, CreateOptions>(nameFunc: (arg: CreateOptions) => string, func: (ctx: runner.TestContext, args: CreateOptions) => Promise<Data>) => Data;
// type fnDelete = <Data, CreateOptions>(nameFunc: (arg: CreateOptions) => string, func: (ctx: runner.TestContext, args: Data) => Promise<void>) => Data;

type fnAddCreateTests = <
    Data extends runner.Data & CreateOptions,
    CreateOptions
>(
    resourceManager: runner.ResourceManager<Data, CreateOptions>,
    nameFunc: (arg: CreateOptions) => string,
    ...opts: CreateOptions[]
) => void;
type fnAddCreateTestsRM<CreateOptions> = (
    nameFunc: (arg: CreateOptions) => string,
    ...opts: CreateOptions[]
) => void;

type fnAddDeleteTests = fnAddCreateTests;
type fnAddDeleteTestsRM<CreateOptions> = fnAddCreateTestsRM<CreateOptions>;

type fnDependsOn = (...names: string[]) => void;
type fnResource = <Data extends runner.Data & CreateOptions, CreateOptions>(
    resourceName: string,
    body: (r: ResourceBuilder<Data, CreateOptions>) => void
) => runner.ResourceManager<Data, CreateOptions>;
type fnSuite = (name: string, body: () => void) => void;
type fnTest = (
    name: string,
    func: (ctx: runner.TestContext) => Promise<void>
) => void;

export interface DslFuncs {
    addCreateTests: fnAddCreateTests;
    addDeleteTests: fnAddDeleteTests;
    // create: fnCreate,
    // delete: fnDelete,
    dependsOn: fnDependsOn;
    resource: fnResource;
    suite: fnSuite;
    test: fnTest;
}

export interface ResourceBuilder<
    Data extends runner.Data & CreateOptions,
    CreateOptions
> {
    create: (
        func: (ctx: runner.TestContext, args: CreateOptions) => Promise<Data>
    ) => void;

    createWrapped: (
        nameFunc: (arg: CreateOptions) => string,
        func: (ctx: runner.TestContext, args: CreateOptions) => Promise<Data>
    ) => void;

    delete: (
        func: (ctx: runner.TestContext, data: Data) => Promise<void>
    ) => void;

    deleteWrapped: (
        nameFunc: (arg: CreateOptions) => string,
        func: (ctx: runner.TestContext, data: Data) => Promise<void>
    ) => void;

    addCreateTests: fnAddCreateTestsRM<CreateOptions>;
    addDeleteTests: fnAddDeleteTestsRM<CreateOptions>;
}

// Creates a set of DSL functions tied tot he given test registry
export const createDslFuncs = (registry: runner.TestRegistry): DslFuncs => {
    const globalTest: fnTest = (
        name: string,
        func: (ctx: runner.TestContext) => Promise<void>
    ) => {
        registry.register({
            dependsOn: [],
            func,
            name,
            priority: runner.Priority.Normal,
            suite: "",
        });
    };

    const globalAddCreateTests: fnAddCreateTests = <
        Data extends runner.Data & CreateOptions,
        CreateOptions
    >(
        resourceManager: runner.ResourceManager<Data, CreateOptions>,
        nameFunc: (arg: CreateOptions) => string,
        ...opts: CreateOptions[]
    ): void => {
        registry.registerCreateTests<Data, CreateOptions>(
            resourceManager,
            nameFunc,
            [],
            runner.Priority.First,
            "",
            ...opts
        );
    };

    const globalAddDeleteTests: fnAddCreateTests = <
        Data extends runner.Data & CreateOptions,
        CreateOptions
    >(
        resourceManager: runner.ResourceManager<Data, CreateOptions>,
        nameFunc: (arg: CreateOptions) => string,
        ...opts: CreateOptions[]
    ): void => {
        registry.registerDeleteTests<Data, CreateOptions>(
            resourceManager,
            nameFunc,
            [],
            runner.Priority.First,
            "",
            ...opts
        );
    };

    const globalSuite: fnSuite = (name: string, body: () => void) => {
        const builder = new SuiteBuilder(name);
        const oldGlobals = currentFuncs;
        try {
            builder.bindCurrentFuncsToThis();
            body();
        } finally {
            currentFuncs = oldGlobals;
        }
    };

    const globalResource: fnResource = <
        Data extends runner.Data & CreateOptions,
        CreateOptions
    >(
        resourceName: string,
        body: (r: ResourceBuilder<Data, CreateOptions>) => void
    ): runner.ResourceManager<Data, CreateOptions> => {
        const builder = new ResourceBuilderImpl<Data, CreateOptions>(
            resourceName
        );
        const oldGlobals = currentFuncs;
        try {
            builder.bindCurrentFuncsToThis();
            body(builder);
        } finally {
            currentFuncs = oldGlobals;
        }
        return builder.resourceManager;
    };

    const globalDependsOn: fnDependsOn = (..._names: string[]) => {
        throw new Error("this must be called from within a suite");
    };

    // interface GlobalBag {
    // dependsOn: (...name: string[]) => void;
    // suite: (name: string, body: () => void) => void;
    // test: (
    //     name: string,
    //     func: (ctx: runner.TestContext) => Promise<void>
    // ) => void;

    let currentFuncs: DslFuncs = {
        addCreateTests: globalAddCreateTests,
        addDeleteTests: globalAddDeleteTests,
        dependsOn: globalDependsOn,
        resource: globalResource,
        suite: globalSuite,
        test: globalTest,
    };

    class SuiteBuilder {
        suiteName: string;
        dependsOnFld: string[];

        constructor(suiteName: string) {
            this.suiteName = suiteName;
            this.dependsOnFld = [];
        }

        bindCurrentFuncsToThis() {
            currentFuncs = {
                addCreateTests: this._addCreateTests.bind(this),
                addDeleteTests: this._addDeleteTests.bind(this),
                dependsOn: this.dependsOn.bind(this),
                resource: this.resource.bind(this),
                suite: this.suite.bind(this),
                test: this.test.bind(this),
            };
        }

        dependsOn(...args: string[]) {
            this.dependsOnFld = args;
        }

        resource<Data extends runner.Data & CreateOptions, CreateOptions>(
            resourceName: string,
            body: (r: ResourceBuilder<Data, CreateOptions>) => void
        ): runner.ResourceManager<Data, CreateOptions> {
            const builder = new ResourceBuilderImpl<Data, CreateOptions>(
                resourceName
            );
            const oldFuncs = currentFuncs;
            try {
                builder.bindCurrentFuncsToThis();
                body(builder);
                return builder.resourceManager;
            } finally {
                currentFuncs = oldFuncs;
            }
        }

        suite(suiteName: string, body: () => void) {
            const builder = new SuiteBuilder(suiteName);
            const oldFuncs = currentFuncs;
            try {
                builder.bindCurrentFuncsToThis();
                body();
            } finally {
                currentFuncs = oldFuncs;
            }
        }

        test(name: string, func: (ctx: runner.TestContext) => Promise<void>) {
            const fullName = `${this.suiteName} ${name}`;
            registry.register({
                dependsOn: this.dependsOnFld,
                func,
                name: fullName,
                priority: runner.Priority.Normal,
                suite: this.suiteName,
            });
        }

        _addCreateTests<
            Data extends runner.Data & CreateOptions,
            CreateOptions
        >(
            resourceManager: runner.ResourceManager<Data, CreateOptions>,
            nameFunc: (arg: CreateOptions) => string,
            ...opts: CreateOptions[]
        ) {
            const newNameFunc = (arg: CreateOptions): string => {
                const name = nameFunc(arg);
                return `${this.suiteName} ${name}`;
            };
            registry.registerCreateTests<Data, CreateOptions>(
                resourceManager,
                newNameFunc,
                this.dependsOnFld,
                runner.Priority.First,
                this.suiteName,
                ...opts
            );
        }

        _addDeleteTests<
            Data extends runner.Data & CreateOptions,
            CreateOptions
        >(
            resourceManager: runner.ResourceManager<Data, CreateOptions>,
            nameFunc: (arg: CreateOptions) => string,
            ...opts: CreateOptions[]
        ) {
            const newNameFunc = (arg: CreateOptions): string => {
                const name = nameFunc(arg);
                return `${this.suiteName} ${name}`;
            };
            registry.registerDeleteTests<Data, CreateOptions>(
                resourceManager,
                newNameFunc,
                this.dependsOnFld,
                runner.Priority.Last,
                this.suiteName,
                ...opts
            );
        }
    }

    class ResourceBuilderImpl<
        Data extends runner.Data & CreateOptions,
        CreateOptions
    > extends SuiteBuilder {
        resourceManager: runner.ResourceManager<Data, CreateOptions>;

        constructor(suiteName: string) {
            super(suiteName);
            this.resourceManager = registry.newResourceRegistry<
                Data,
                CreateOptions
            >(suiteName);
        }

        create(
            func: (
                ctx: runner.TestContext,
                args: CreateOptions
            ) => Promise<Data>
        ) {
            this.resourceManager.registerCreateFunc(func);
        }

        createWrapped(
            nameFunc: (arg: CreateOptions) => string,
            func: (
                ctx: runner.TestContext,
                args: CreateOptions
            ) => Promise<Data>
        ) {
            this.resourceManager.registerWrappedCreateFunc(
                (arg: CreateOptions) => {
                    const name = nameFunc(arg);
                    return `${this.suiteName} ${name}`;
                },
                func
            );
        }

        delete(func: (ctx: runner.TestContext, data: Data) => Promise<void>) {
            this.resourceManager.registerDeleteFunc(func);
        }

        deleteWrapped(
            nameFunc: (arg: CreateOptions) => string,
            func: (ctx: runner.TestContext, data: Data) => Promise<void>
        ) {
            this.resourceManager.registerWrappedDeleteFunc(
                (arg: CreateOptions) => {
                    const name = nameFunc(arg);
                    return `${this.suiteName} ${name}`;
                },
                func
            );
        }

        addCreateTests(
            nameFunc: (arg: CreateOptions) => string,
            ...opts: CreateOptions[]
        ) {
            this._addCreateTests(this.resourceManager, nameFunc, ...opts);
        }

        addDeleteTests(
            nameFunc: (arg: CreateOptions) => string,
            ...opts: CreateOptions[]
        ) {
            this._addDeleteTests(this.resourceManager, nameFunc, ...opts);
        }
    }

    return {
        addCreateTests: <
            Data extends runner.Data & CreateOptions,
            CreateOptions
        >(
            resourceManager: runner.ResourceManager<Data, CreateOptions>,
            nameFunc: (arg: CreateOptions) => string,
            ...opts: CreateOptions[]
        ): void => {
            currentFuncs.addCreateTests(resourceManager, nameFunc, ...opts);
        },
        addDeleteTests: <
            Data extends runner.Data & CreateOptions,
            CreateOptions
        >(
            resourceManager: runner.ResourceManager<Data, CreateOptions>,
            nameFunc: (arg: CreateOptions) => string,
            ...opts: CreateOptions[]
        ): void => {
            currentFuncs.addDeleteTests(resourceManager, nameFunc, ...opts);
        },
        dependsOn: (...names: string[]) => {
            currentFuncs.dependsOn(...names);
        },
        resource: <Data extends runner.Data & CreateOptions, CreateOptions>(
            resourceName: string,
            body: (r: ResourceBuilder<Data, CreateOptions>) => void
        ): runner.ResourceManager<Data, CreateOptions> => {
            return currentFuncs.resource(resourceName, body);
        },
        suite: (name: string, body: () => void) => {
            currentFuncs.suite(name, body);
        },
        test: (
            name: string,
            func: (ctx: runner.TestContext) => Promise<void>
        ) => {
            currentFuncs.test(name, func);
        },
    };
};

// let globals: GlobalBag = {
//     dependsOn: globalDependsOn,
//     suite: globalSuite,
//     test: globalTest,
// };

// const dependsOn = (...names: string[]) => {
//     globals.dependsOn(...names);
// };

// const suite = (name: string, body: () => void) => {
//     globals.suite(name, body);
// };

// const test = (
//     name: string,
//     func: (ctx: runner.TestContext) => Promise<void>
// ) => {
//     globals.test(name, func);
// };
