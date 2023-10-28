import * as chai from "chai";

import {
    createSelfTestRegistry,
    runTests,
    createTestList,
    getResourceInfo,
    SelfTestMonitor,
} from "./utils";
import {
    createChildren,
    createGrandParents,
    createParents,
} from "./exampleResources";

// Tests NAF itself.
describe("when running tests", () => {
    test("a simple suite with one resource should be ordered", async () => {
        chai.config.showDiff = true;
        chai.config.truncateThreshold = 0;

        const monitor = new SelfTestMonitor();

        const registry = createSelfTestRegistry();
        createGrandParents(monitor, registry);

        {
            const actual = createTestList(registry);
            chai.assert.deepEqual(["examples get_grandparent aws"], actual);
        }
        {
            const actual = await runTests(monitor, registry);
            chai.assert.deepEqual(
                [
                    "START examples get_grandparent aws",
                    "START examples create_grandparents aws",
                    "POST examples/grandparents",
                    "FINISH examples create_grandparents aws :: passed",
                    "GET examples/grandparents/TN-0",
                    "FINISH examples get_grandparent aws :: passed",
                ],
                actual,
            );
        }
    });

    test("a test featuring a resource which depends on another should work", async () => {
        chai.config.showDiff = true;
        chai.config.truncateThreshold = 0;

        // This time we've got two resources / suites
        const monitor = new SelfTestMonitor();

        const registry = createSelfTestRegistry();

        createParents(monitor, registry);

        {
            const actual = createTestList(registry);
            chai.assert.deepEqual(
                [
                    "examples get_grandparent aws",
                    "examples create_parent aws",
                    "examples create_parent azure",
                    "examples get_parent aws",
                    "examples delete_parent aws",
                    "examples delete_parent azure",
                ],
                actual,
            );
        }
        {
            const actual = await runTests(monitor, registry);
            chai.assert.deepEqual(actual, [
                "START examples get_grandparent aws",
                "START examples create_grandparents aws",
                "POST examples/grandparents",
                "FINISH examples create_grandparents aws :: passed",
                "GET examples/grandparents/TN-0",
                "FINISH examples get_grandparent aws :: passed",
                "START examples create_parent aws",
                "POST /examples/parents (using grandparent id=TN-0, aws, aws)",
                "   result id = TN-2",
                "FINISH examples create_parent aws :: passed",
                "START examples create_parent azure",
                "START examples create_grandparents azure",
                "POST examples/grandparents",
                "FINISH examples create_grandparents azure :: passed",
                "POST /examples/parents (using grandparent id=TN-4, azure, azure)",
                "   result id = TN-6",
                "FINISH examples create_parent azure :: passed",
                "START examples get_parent aws",
                "GET /examples/parents TN-2",
                "FINISH examples get_parent aws :: passed",
                "START examples delete_parent aws",
                "DELETE /examples/parents TN-2, aws",
                "FINISH examples delete_parent aws :: passed",
                "START examples delete_parent azure",
                "DELETE /examples/parents TN-6, azure",
                "FINISH examples delete_parent azure :: passed",
            ]);

            const info = getResourceInfo(registry);

            chai.assert.deepEqual(
                `Resource info:
grandparents:
{"data":{"id":"TN-0","name":"TN-1","favoriteProvider":"aws"},"dependents":[],"lockedBy":null}
{"data":{"id":"TN-4","name":"TN-5","favoriteProvider":"azure"},"dependents":[],"lockedBy":null}
parents:
  deleted: {"data":{"favoriteProvider":"aws","grandparentId":"TN-0","id":"TN-2","name":"TN-3"},"dependents":[],"lockedBy":null}
  deleted: {"data":{"favoriteProvider":"azure","grandparentId":"TN-4","id":"TN-6","name":"TN-7"},"dependents":[],"lockedBy":null}`,
                info,
            );
        }
    });

    test("a complex test with three resources / suites should work", async () => {
        chai.config.showDiff = true;
        chai.config.truncateThreshold = 0;

        const monitor = new SelfTestMonitor();

        // This time we've got three resources / suites.
        // The dependency chain between grandparents -> parents -> children reflects
        // networks -> clusters -> backups.
        const registry = createSelfTestRegistry();
        createChildren(monitor, registry);

        {
            const actual = createTestList(registry);
            chai.assert.deepEqual(
                [
                    "examples get_grandparent aws",
                    "examples create_parent aws",
                    "examples create_parent azure",
                    "examples get_parent aws",
                    "examples create_child aws",
                    "examples create_child azure",
                    "examples get_child aws",
                    "examples delete_child aws",
                    "examples delete_child azure",
                    "examples delete_parent aws",
                    "examples delete_parent azure",
                ],
                actual,
            );
        }
        {
            const actual = await runTests(monitor, registry);
            // Note that the tests create a grandparent, then a parent, then go back
            // and create a grandparent again. That's because there's no explicit
            // test to create a grand parent whose favorite cloud provider is
            // Azure, so it doesn't bother running it first.
            chai.assert.deepEqual(
                [
                    "START examples get_grandparent aws",
                    "START examples create_grandparents aws",
                    "POST examples/grandparents",
                    "FINISH examples create_grandparents aws :: passed",
                    "GET examples/grandparents/TN-0",
                    "FINISH examples get_grandparent aws :: passed",
                    "START examples create_parent aws",
                    "POST /examples/parents (using grandparent id=TN-0, aws, aws)",
                    "   result id = TN-2",
                    "FINISH examples create_parent aws :: passed",
                    "START examples create_parent azure",
                    "START examples create_grandparents azure",
                    "POST examples/grandparents",
                    "FINISH examples create_grandparents azure :: passed",
                    "POST /examples/parents (using grandparent id=TN-4, azure, azure)",
                    "   result id = TN-6",
                    "FINISH examples create_parent azure :: passed",
                    "START examples get_parent aws",
                    "GET /examples/parents TN-2",
                    "FINISH examples get_parent aws :: passed",
                    "START examples create_child aws",
                    "POST /examples/children (using parent id=TN-2)",
                    "   result id = TN-8",
                    "FINISH examples create_child aws :: passed",
                    "START examples create_child azure",
                    "POST /examples/children (using parent id=TN-6)",
                    "   result id = TN-10",
                    "FINISH examples create_child azure :: passed",
                    "START examples get_child aws",
                    "GET /examples/child TN-8",
                    "FINISH examples get_child aws :: passed",
                    "START examples delete_child aws",
                    "DELETE /examples/children TN-8",
                    "FINISH examples delete_child aws :: passed",
                    "START examples delete_child azure",
                    "DELETE /examples/children TN-10",
                    "FINISH examples delete_child azure :: passed",
                    "START examples delete_parent aws",
                    "DELETE /examples/parents TN-2, aws",
                    "FINISH examples delete_parent aws :: passed",
                    "START examples delete_parent azure",
                    "DELETE /examples/parents TN-6, azure",
                    "FINISH examples delete_parent azure :: passed",
                ],
                actual,
            );

            const info = getResourceInfo(registry);

            chai.assert.deepEqual(
                `Resource info:
grandparents:
{"data":{"id":"TN-0","name":"TN-1","favoriteProvider":"aws"},"dependents":[],"lockedBy":null}
{"data":{"id":"TN-4","name":"TN-5","favoriteProvider":"azure"},"dependents":[],"lockedBy":null}
parents:
  deleted: {"data":{"favoriteProvider":"aws","grandparentId":"TN-0","id":"TN-2","name":"TN-3"},"dependents":[],"lockedBy":null}
  deleted: {"data":{"favoriteProvider":"azure","grandparentId":"TN-4","id":"TN-6","name":"TN-7"},"dependents":[],"lockedBy":null}
children:
  deleted: {"data":{"favoriteProvider":"aws","parentId":"TN-2","id":"TN-8","name":"TN-9"},"dependents":[],"lockedBy":null}
  deleted: {"data":{"favoriteProvider":"azure","parentId":"TN-6","id":"TN-10","name":"TN-11"},"dependents":[],"lockedBy":null}`,
                info,
            );
        }
    });
});
