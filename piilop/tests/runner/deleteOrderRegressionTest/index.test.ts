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
            chai.assert.deepEqual(
                actual,
                [
                    "START create container ubuntu",
                    "FINISH create container ubuntu :: passed",
                    "START create container windows",
                    "FINISH create container windows :: passed",
                    "START test we can get Ubuntu containers",
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
                    "START test we can get Ubuntu containers",
                    "FINISH test we can get Ubuntu containers :: passed",
                    "START create app on os ubuntu, pkg name nodejs",
                    "FINISH create app on os ubuntu, pkg name nodejs :: passed",
                    "START create app on os windows, pkg name skifree",
                    "FINISH create app on os windows, pkg name skifree :: passed",
                    "START create app on os macos, pkg name GarageBand",
                    "START create container macos",
                    "FINISH create container macos :: passed",
                    "FINISH create app on os macos, pkg name GarageBand :: passed",
                    "START test Python on Ubuntu",
                    "START create app on os ubuntu, pkg name python",
                    "FINISH create app on os ubuntu, pkg name python :: passed",
                    "FINISH test Python on Ubuntu :: passed",
                    "START test Go on Ubuntu",
                    "START create app on os ubuntu, pkg name golang",
                    "FINISH create app on os ubuntu, pkg name golang :: passed",
                    "FINISH test Go on Ubuntu :: passed",
                    "START test Mpx Play on FreeDOS",
                    "START create app on os freedos, pkg name mpxplay",
                    "START create container freedos",
                    "FINISH create container freedos :: passed",
                    "FINISH create app on os freedos, pkg name mpxplay :: passed",
                    "FINISH test Mpx Play on FreeDOS :: passed",
                    "START delete app on os ubuntu, pkg name nodejs",
                    "FINISH delete app on os ubuntu, pkg name nodejs :: passed",
                    "START delete app on os ubuntu, pkg name golang",
                    "FINISH delete app on os ubuntu, pkg name golang :: passed",
                    "START delete app on os ubuntu, pkg name python",
                    "FINISH delete app on os ubuntu, pkg name python :: passed",
                    "START delete container ubuntu",
                    "FINISH delete container ubuntu :: passed",
                ],
                actual
            );
        }
    })
})