import * as chai from "chai";

import {
    createSelfTestRegistry,
    runTests,
    createTestList,
} from "../../runner/utils";

import { FakeSaasServiceState } from "./client";
import { createContainers } from "./containers";
import { createApps } from "./apps";

describe("order / resource fetching should work with delete", () => {
    test("test container example", async () => {
        chai.config.showDiff = true;
        chai.config.truncateThreshold = 0;

        const registry = createSelfTestRegistry();

        const service = new FakeSaasServiceState();

        createContainers(service, registry);

        {
            const actual = createTestList(registry);
            chai.assert.deepEqual(actual, [
                "create container ubuntu",
                "create container windows",
                "test we can get Ubuntu containers",
                "delete container ubuntu",
            ]);
        }
        {
            const actual = await runTests(registry);
            // TODO: this seems very clearly wrong: the "delete" is happening
            //       before a test that gets the containers.
            //       Looking at it, `registerDeleteTests` creates tests that
            //       use delete but doesn't set this priority to anything special,
            //      so it seems correct that they could run before the other
            //      tests have finished. A simple fix could be to change the priority
            //      to last, which I will try after recreating the other bug
            //      that caused me to look into this.
            //      UPDATE: the DSL seems to pass "Priority.First" to both the
            //      create and delete test helpers. That seems wrong?
            //      But also the helper shouldn't even need to do this as the
            //      lower level API should pass an option by default.
            chai.assert.deepEqual(
                actual,
                [
                    "START create container ubuntu",
                    "FINISH create container ubuntu :: passed",
                    "START create container windows",
                    "FINISH create container windows :: passed",
                    "START test we can get Ubuntu containers",
                    "START create container ubuntu",
                    "FINISH create container ubuntu :: passed",
                    "FINISH test we can get Ubuntu containers :: passed",
                    "START delete container ubuntu",
                    "FINISH delete container ubuntu :: passed",
                ]
            );
        }
    })

    test("test container and app example", async () => {
        chai.config.showDiff = true;
        chai.config.truncateThreshold = 0;

        const registry = createSelfTestRegistry();

        const service = new FakeSaasServiceState();

        const containers = createContainers(service, registry);
        createApps(service, registry, containers);

        {
            const actual = await runTests(registry);
            chai.assert.deepEqual(
                [
                    "START create container ubuntu",
                    "FINISH create container ubuntu :: passed",
                    "START create container windows",
                    "FINISH create container windows :: passed",
                    "START delete container ubuntu",
                    "FINISH delete container ubuntu :: passed",
                    "START test we can get Ubuntu containers",
                    "START create container ubuntu",
                    "FINISH create container ubuntu :: passed",
                    "FINISH test we can get Ubuntu containers :: passed",
                ],
                actual
            );
        }
    })
})