// naf stands for "not a framework." If you're worried we built our own framework
// for these tests, don't worry, because we didn't. After all it's in the name.
// NAF organizes a bunch of "TestEntries" which are runnable functions associated
// with names and suites. It also stores "ResourceManager"s which remember the
// resources spun up during a test run, can look them up based on their attributes
// and can create new ones if they aren't there. NAF also had the ability to order
// the tests so that stuff runs in an optimal order, making everything faster.
// See "./selfTests" for more info.
export { Priority } from "./core";
export { ResourceManager } from "./runner";
export { randomName } from "./runner";
export { TestContext } from "./runner";
export { TestMain } from "./runner";
export { TestRegistry } from "./runner";
export { TestStatus } from "./runner";

import { TestRegistry } from "./runner";
import * as dsl from "./sugar/dsl";

// export { registry, newResourceManager, test } from "./sugar";

// This is where we make the global variables the tests use for convenience.
// This is to keep things "easy", but note that with relatively small changes
// we could avoid globals altogether. See the "selfTests" directories for
// examples of how the guts of all this actually works.

export const registry = new TestRegistry();

export const { addCreateTests, addDeleteTests, dependsOn, resource, suite, test } =
    dsl.createDslFuncs(registry);
