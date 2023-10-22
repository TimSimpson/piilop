import * as chai from "chai";

import {
    createSelfTestRegistry,
    runTests,
    createTestList,
    getResourceInfo,
} from "../runner/utils";
import {
    createChildren,
    createGrandParents,
    createGrandParentsUsingWrappedCreateAndDeletes,
    createParents,
} from "./exampleResources";

describe("the resource keyword makes it easy to create resources", () => {
    test("grandparents", async () => {
        const registry = createSelfTestRegistry();
        createGrandParents(registry);

        {
            const actual = createTestList(registry);
            chai.assert.deepEqual(["grandparents get_grandparent aws"], actual);
        }
        {
            const actual = await runTests(registry);
            chai.assert.deepEqual(
                [
                    "START grandparents get_grandparent aws",
                    "POST examples/grandparents",
                    "GET examples/grandparents/TN-0",
                    "FINISH grandparents get_grandparent aws :: passed",
                ],
                actual,
            );
        }
    });

    test("grandparents with wrapped create and delete", async () => {
        const registry = createSelfTestRegistry();
        createGrandParentsUsingWrappedCreateAndDeletes(registry);

        {
            const actual = createTestList(registry);
            chai.assert.deepEqual(["grandparents get_grandparent aws"], actual);
        }
        {
            const actual = await runTests(registry);
            chai.assert.deepEqual(
                [
                    "START grandparents get_grandparent aws",
                    "START grandparents create_grandparents aws",
                    "POST examples/grandparents",
                    "FINISH grandparents create_grandparents aws :: passed",
                    "GET examples/grandparents/TN-0",
                    "FINISH grandparents get_grandparent aws :: passed",
                ],
                actual,
            );
        }
    });

    test("parents", async () => {
        // This time we've got two resources / suites
        const registry = createSelfTestRegistry();
        createParents(registry);

        {
            const actual = createTestList(registry);
            chai.assert.deepEqual(
                [
                    "grandparents get_grandparent aws",
                    "parents create_parent aws",
                    "parents create_parent azure",
                    "parents get_parent aws",
                    "parents delete_parent aws",
                    "parents delete_parent azure",
                ],
                actual,
            );
        }
        {
            const actual = await runTests(registry);
            // TODO(tss): this has repeating entries because of my original, foolish,
            // decision to wrap each create function as if it was a test itself.
            // I know think wrapping it so the context knows about it is necessary,
            // but it shouldn't have the exact same name. Hmmm.... what to do...

            chai.assert.deepEqual(
                [
                    "START grandparents get_grandparent aws",
                    "POST examples/grandparents",
                    "GET examples/grandparents/TN-0",
                    "FINISH grandparents get_grandparent aws :: passed",
                    "START parents create_parent aws",
                    "POST /examples/parents (using grandparent id=TN-0, aws, aws)",
                    "   result id = TN-2",
                    "FINISH parents create_parent aws :: passed",
                    "START parents create_parent azure",
                    "POST examples/grandparents",
                    "POST /examples/parents (using grandparent id=TN-4, azure, azure)",
                    "   result id = TN-6",
                    "FINISH parents create_parent azure :: passed",
                    "START parents get_parent aws",
                    "GET /examples/parents TN-2",
                    "FINISH parents get_parent aws :: passed",
                    "START parents delete_parent aws",
                    "DELETE /examples/parents TN-2, aws",
                    "FINISH parents delete_parent aws :: passed",
                    "START parents delete_parent azure",
                    "DELETE /examples/parents TN-6, azure",
                    "FINISH parents delete_parent azure :: passed",
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
  deleted: {"data":{"favoriteProvider":"azure","grandparentId":"TN-4","id":"TN-6","name":"TN-7"},"dependents":[],"lockedBy":null}`,
                info,
            );
        }
    });

    test("children", async () => {
        // This time we've got three resources / suites.
        // The dependency chain between grandparents -> parents -> children reflects
        // networks -> clusters -> backups.
        const registry = createSelfTestRegistry();
        createChildren(registry);

        {
            const actual = createTestList(registry);
            chai.assert.deepEqual(
                [
                    "grandparents get_grandparent aws",
                    "parents create_parent aws",
                    "parents create_parent azure",
                    "parents get_parent aws",
                    "children create_child aws",
                    "children create_child azure",
                    "children get_child aws",
                    "children get_child azure",
                    "children get_child azure 2",
                    "children delete_child aws",
                    "children delete_child azure",
                    "parents delete_parent aws",
                    "parents delete_parent azure",
                ],
                actual,
            );
        }
        {
            const actual = await runTests(registry);
            // Note that the tests create a grandparent, then a parent, then go back
            // and create a grandparent again. That's because there's no explicit
            // test to create a grand parent whose favorite cloud provider is
            // Azure, so it doesn't bother running it first.
            chai.assert.deepEqual(
                [
                    "START grandparents get_grandparent aws",
                    "POST examples/grandparents",
                    "GET examples/grandparents/TN-0",
                    "FINISH grandparents get_grandparent aws :: passed",
                    "START parents create_parent aws",
                    "POST /examples/parents (using grandparent id=TN-0, aws, aws)",
                    "   result id = TN-2",
                    "FINISH parents create_parent aws :: passed",
                    "START parents create_parent azure",
                    "POST examples/grandparents",
                    "POST /examples/parents (using grandparent id=TN-4, azure, azure)",
                    "   result id = TN-6",
                    "FINISH parents create_parent azure :: passed",
                    "START parents get_parent aws",
                    "GET /examples/parents TN-2",
                    "FINISH parents get_parent aws :: passed",
                    "START children create_child aws",
                    "POST /examples/children (using parent id=TN-2)",
                    "   result id = TN-8",
                    "FINISH children create_child aws :: passed",
                    "START children create_child azure",
                    "POST /examples/children (using parent id=TN-6)",
                    "   result id = TN-10",
                    "FINISH children create_child azure :: passed",
                    "START children get_child aws",
                    "GET /examples/child TN-8",
                    "FINISH children get_child aws :: passed",
                    "START children get_child azure",
                    "GET /examples/child TN-10",
                    "FINISH children get_child azure :: passed",
                    "START children get_child azure 2",
                    "GET /examples/child TN-10",
                    "FINISH children get_child azure 2 :: passed",
                    "START children delete_child aws",
                    "DELETE /examples/children TN-8",
                    "FINISH children delete_child aws :: passed",
                    "START children delete_child azure",
                    "DELETE /examples/children TN-10",
                    "FINISH children delete_child azure :: passed",
                    "START parents delete_parent aws",
                    "DELETE /examples/parents TN-2, aws",
                    "FINISH parents delete_parent aws :: passed",
                    "START parents delete_parent azure",
                    "DELETE /examples/parents TN-6, azure",
                    "FINISH parents delete_parent azure :: passed",
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
