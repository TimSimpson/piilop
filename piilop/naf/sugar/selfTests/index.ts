import * as dsl from "../dsl";
import * as runnerUtils from "../../runner/selfTests/utils";
import { selfTests as exampleResourcesTests } from "./exampleResourcesTests";

export const simpleTests = () => {
    console.log("hi");

    const registry = runnerUtils.createSelfTestRegistry();

    const { dependsOn, suite, test } = dsl.createDslFuncs(registry);

    suite("projects", () => {
        test("create_proejct", async (_ctx) => {});
    });

    suite("misc", () => {
        dependsOn("projects");
        test("create_note", async (ctx) => {
            ctx.log("Greetings from note land!");
        });

        test("create another note", async (ctx) => {
            ctx.log("Another note created!");
        });
    });

    runnerUtils.runTests(registry, "all");

    // const registry = new runner.TestRegistry();

    // dsl.createDslFuncs()
    // suite("misc", () => {
    //     dependsOn("projects");
    //     console.log("where am I?");
    //     test("create_note", async (_ctx) => {
    //         console.log("Greetings from note land!");
    //     });

    //     test("create another note", async (_ctx) => {
    //         console.log("Another note created!");
    //     });
    // });
    // console.log("hmm");

    // const entries = registry.getEntries();
    // console.log(JSON.stringify(entries));
};

export const selfTests = () => {
    simpleTests();
    exampleResourcesTests();
};
