import { TestMain, TestRegistry } from "../../naf/runner";

export const createSelfTestRegistry = (): TestRegistry => {
    // For the tests, we create a custom registry. Typically a global
    // variable is used everywhere for convenience, but the goal here is to
    // (hopefully) show how this works.
    const registry = new TestRegistry();

    return registry;
};

export const createSelfTestMain = (registry: TestRegistry): TestMain => {
    const main = new TestMain(registry);

    // let depth = 0;

    main.startTest = (name) => {
        main.ctx.log(`START ${name}`);
        // ++depth;
    };
    main.finishTest = (name, status) => {
        main.ctx.log(`FINISH ${name} :: ${status}`);
        // --depth;
    };

    // const orginalLog = main.ctx.log;
    // main.ctx.log = (msg: string) => {
    //     orginalLog(`${'- '.repeat(depth)}${msg}`);
    // }

    let incrementingNameIndex = 0;

    const createIncrementingName = (): string => {
        // TN == Test Number
        return `TN-${incrementingNameIndex++}`;
    };

    main.ctx.opts.createArbitraryName = createIncrementingName;

    return main;
};

// creates a new "main", runs the tests, and returns the ctx logs
export const runTests = async (
    registry: TestRegistry,
    test?: string,
): Promise<string[]> => {
    const main = createSelfTestMain(registry);
    await main.runTest(test);
    return main.ctx.getLogs();
};

export const createTestList = (registry: TestRegistry): string[] => {
    const list: string[] = [];
    const main = createSelfTestMain(registry);
    main.showTestList((s) => list.push(s));
    return list;
};

export const getResourceInfo = (registry: TestRegistry): string => {
    const info: string[] = [];
    registry.getResourceManager().info((msg: string) => info.push(msg));
    return info.join("\n");
};
