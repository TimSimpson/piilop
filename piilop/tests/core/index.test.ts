// import { add } from '../naf/index';
import * as chai from "chai";
import type { ITestContext, TestContextPushArgs } from "../../piilop/core/base";
import { isWrapped, wrap } from "../../piilop/core/base";

class TestContextImpl {
    _currentTestName: string;
    defered: Function[];
    parent: TestContextImpl | null;

    constructor(parent?: TestContextImpl, testName?: string) {
        this._currentTestName = testName || "<null>";
        this.defered = [];
        this.parent = parent || null;
    }

    begin(args: TestContextPushArgs): TestContextImpl {
        return new TestContextImpl(this, args.name);
    }

    async cleanUp(): Promise<void> {
        for (const d of this.defered) {
            d();
        }
    }

    currentTestName(): string {
        return this._currentTestName;
    }

    // schedules a clean up task to run in the _parent_ context
    defer(caller: number, f: Function) {
        let target: TestContextImpl | null = this;
        while (caller > 0) {
            target = target.parent;
            if (target == null) {
                throw new Error(
                    "cannot execute defer; no parent is at that level",
                );
            }
            --caller;
        }
        target.defered.push(f);
    }

    end(): TestContextImpl {
        this.cleanUp();
        if (this.parent === null) {
            throw new Error("out of TestContext's to pop!");
        } else {
            return this.parent;
        }
    }
}

let log: string[] = [];

const s = async (ctx: TestContextImpl, a: string): Promise<string> => {
    ctx.defer(1, () => {
        log.push("cleanup time!");
    });
    log.push(`called s with ${a}`);
    log.push(`Current test name = ${ctx.currentTestName()}`);
    return a;
};

async function w(_ctxW: ITestContext) {
    log.push(`called w`);
}

const wrappedS = wrap(s);
const wrappedW = wrap(w);

const wrappedS2 = wrap(
    async (ctx: TestContextImpl, num: number): Promise<string> => {
        log.push(`hi! Current test = ${ctx.currentTestName()}`);
        const result = await wrappedS(ctx, num.toString());
        log.push(`bye!! Current test = ${ctx.currentTestName()}`);
        return result;
    },
    { name: "wrappedS2" },
);

const createResource = wrap(
    async (ctx: TestContextImpl, provider: string): Promise<string> => {
        log.push(`createResource! Current test = ${ctx.currentTestName()}`);
        log.push(`creating a resource with provider ${provider}`);
        ctx.defer(1, () => log.push(`cleaning up resouce for ${provider}`));
        return `resource ${provider}`;
    },
    {
        nameFunc: (provider) => `create resources ${provider}`,
    },
);

const useResource = wrap(
    async (ctx: TestContextImpl, provider: string): Promise<void> => {
        log.push(`hi! Current test = ${ctx.currentTestName()}`);
        const resource = await createResource(ctx, provider);
        log.push(`using resource ${resource}`);
        log.push(`bye!! Current test = ${ctx.currentTestName()}`);
    },
    { nameFunc: (provider: string) => `useResource ${provider}` },
);

describe("testing index file", () => {
    test("empty string should result in zero", async () => {
        const ctx = new TestContextImpl();

        const actual = await wrappedS(ctx, "hi");
        chai.assert.deepEqual("hi", actual);

        chai.assert.deepEqual(
            ["called s with hi", "Current test name = s"],
            log,
        );

        await ctx.cleanUp();

        chai.assert.deepEqual(
            ["called s with hi", "Current test name = s", "cleanup time!"],
            log,
        );

        chai.assert.deepEqual(false, isWrapped(s));
        chai.assert.deepEqual(true, isWrapped(wrappedS));
        chai.assert.deepEqual(false, isWrapped(w));
        chai.assert.deepEqual(true, isWrapped(wrappedW));

        log = [];
        const result = await wrappedS2(ctx, 42);
        chai.assert.deepEqual("42", result);
        chai.assert.deepEqual(
            [
                "hi! Current test = wrappedS2",
                "called s with 42",
                "Current test name = s",
                "bye!! Current test = wrappedS2",
                "cleanup time!",
            ],
            log,
        );

        log = [];
        await useResource(ctx, "AWS");
        chai.assert.deepEqual(
            [
                "hi! Current test = useResource AWS",
                "createResource! Current test = create resources AWS",
                "creating a resource with provider AWS",
                "using resource resource AWS",
                "bye!! Current test = useResource AWS",
                "cleaning up resouce for AWS",
            ],
            log,
        );
    });
});
