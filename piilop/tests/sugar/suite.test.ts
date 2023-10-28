import * as dsl from "../../piilop/sugar/dsl";
import * as runnerUtils from "../runner/utils";

describe("the suite keyword makes it easy to create simple tests and ordering", () => {
    test("simple", async () => {
        console.log("hi");

        const monitor = new runnerUtils.SelfTestMonitor();

        const registry = runnerUtils.createSelfTestRegistry();

        const { dependsOn, suite, test } = dsl.createDslFuncs(registry);

        suite("projects", () => {
            test("create_proejct", async (_ctx) => {});
        });

        suite("misc", () => {
            dependsOn("projects");
            test("create_note", async (_ctx) => {
                monitor.log("Greetings from note land!");
            });

            test("create another note", async (_ctx) => {
                monitor.log("Another note created!");
            });
        });

        runnerUtils.runTests(monitor, registry, "all");

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
    });
    test("resources test", async () => {});
});
