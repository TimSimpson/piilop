import {
    Priority,
    ResourceManager,
    TestContext,
    TestRegistry,
} from "../../piilop/runner";
import * as chai from "chai";
import { SelfTestMonitor } from "./utils";

// In NAF, resources need the following:

// This is a "data" type which is basically the expected data for this
// resource. We create it when we create the actual resource by calling the API
// somehow.
// The other rule: it must be easy to serialize into a JSON object.
type GrandparentData = {
    id: string; // this must be present on ALL resources, and be unique
    name: string; // this can be anything
    favoriteProvider: string; // they're favorite cloud provider
};

// This is a type represents the arg payload we will pass to a resource we need
// to create. It must be a subset of the Data type, as we may also look through
// existing instances of Data to see if we don't need to create one in the first
// place.
type NewGrandparentArgs = { favoriteProvider: string };

type Grandparents = ResourceManager<GrandparentData, NewGrandparentArgs>;

export const asyncAction = async () => {};

export const createGrandParents = (monitor: SelfTestMonitor, registry: TestRegistry): Grandparents => {
    // Here we create a resource manager. Typically it's a global variable so the various tests
    // can grab it.
    const grandparents = registry.newResourceRegistry<
        GrandparentData,
        NewGrandparentArgs
    >("grandparents");

    // As part of creating the resource manager, we need to tell it how to create
    // stuff if nothing is found. This does that and is also a test.
    grandparents.registerWrappedCreateFunc(
        // Note that "interests" forms part of the test name
        (args) => `examples create_grandparents ${args.favoriteProvider}`,
        async (
            _ctx: TestContext,
            args: NewGrandparentArgs,
        ): Promise<GrandparentData> => {
            // Inside this code, we are running a test called `example create_grandparents`.
            // This "test" may run multiple times.
            monitor.log(`POST examples/grandparents`);
            await asyncAction();
            const grandparent = {
                id: monitor.createArbitraryName(),
                name: monitor.createArbitraryName(),
                favoriteProvider: args.favoriteProvider,
            };
            return grandparent;
        },
    );

    // now we'll register a test that gets
    registry.register({
        name: "examples get_grandparent aws", // the name of the test
        suite: "grandparents",
        dependsOn: [],
        priority: Priority.Normal,
        func: (ctx: TestContext): Promise<void> => {
            // In this test we just want to "get" a grandparent and check the
            // properties, but to do that we need to have expected data
            // meaning we need to call the `getOrCreate` method of the
            // resource manager.
            //
            return grandparents.findDataAndCall(
                {
                    // these tell it how to create a new resource if none are found
                    createArgs: { favoriteProvider: "aws" },
                    // when we grab the data from the collection, we can modify
                    // it before using it. The default is similar to what is
                    // shown below, this is just to illustrate it.
                    modifierPre: (data) => {
                        data.lockedBy = "get grandparent test";
                    },
                    // when we're done with the data, we can modify the state
                    // held by the resource manager again
                    modifierPost: (data) => {
                        data.lockedBy = null;
                    },
                    // There's two ways to search for data: search the data,
                    // or search the "state" - there's an example of this later
                    // on
                    searchData: (data) => data.favoriteProvider == "aws",
                },
                ctx,
                (grandparent: GrandparentData) => {
                    monitor.log(`GET examples/grandparents/${grandparent.id}`);
                    chai.assert.equal(grandparent.favoriteProvider, "aws");
                },
            );
        },
    });

    grandparents.registerDeleteFunc(async (_ctx, data) => {
        monitor.log(`DELETE examples/grandparents/${data.id}`);
    });

    return grandparents;
};

// This is a second data type. Not much is different from GrandparentData above,
// however this has a reference to it using the ID, much like the real
// resources in other systems.
type ParentData = {
    id: string;
    name: string;
    grandparentId: string;
    // Pretend for a second that the imaginary "parent" resource, when you
    // call the API, doesn't return the `favoriteProvider` as it's going
    // to be the same as the grandparent. However, we store it in the
    // Data type anyway because it's necessary when _creating_ a resource-
    // and everything in the create args type must be in the data.
    favoriteProvider: string;
};

type NewParentArgs = { favoriteProvider: string };

type Parents = ResourceManager<ParentData, NewParentArgs>;

export const createParents = (monitor: SelfTestMonitor, registry: TestRegistry): Parents => {
    const grandparents = createGrandParents(monitor, registry);

    // here's the resource manager. We use a diferent method of creating it here
    // to test / demonstrate it
    const parents = registry.newResourceManager<ParentData, NewParentArgs>({
        resourceName: "parents",
        dependsOn: ["grandparents"],
        create: {
            testName: (args) =>
                `examples create_parent ${args.favoriteProvider}`,
            // these are all the cases we want to register - meaning they'll be
            // callable from the command line directly, as well as when the
            // resource manager's create function is used.
            testCases: [
                { favoriteProvider: "aws" },
                { favoriteProvider: "azure" },
            ],
            func: (ctx, createArgs) => {
                // here we use the grandparent's resource to get a grand parent
                // first. We use `findState` because we have to mark the fact
                // that the grandParent now has a dependent.
                return grandparents.findStateAndCall(
                    {
                        createArgs,
                    },
                    ctx,
                    (state) => {
                        monitor.log(
                            `POST /examples/parents (using grandparent id=${state.data.id}, ${createArgs.favoriteProvider}, ${state.data.favoriteProvider})`,
                        );
                        const result = {
                            favoriteProvider: createArgs.favoriteProvider,
                            grandparentId: state.data.id,
                            id: monitor.createArbitraryName(),
                            name: monitor.createArbitraryName(),
                        };
                        monitor.log(`   result id = ${result.id}`);
                        state.dependents.push(`parents-${result.id}`);
                        return result;
                    },
                );
            },
        },
        delete: {
            testName: (args) =>
                `examples delete_parent ${args.favoriteProvider}`,
            testCases: [
                { favoriteProvider: "aws" },
                { favoriteProvider: "azure" },
            ],
            // Compared to the create func, this is pretty anticlimatic. This
            // method, when it creates test cases, will make them search for
            // data in the resource manager that has no dependents to avoid
            // deleting data tha could still be in use (oftentimes in complex
            // systems it's not even possible to delete resources with children)
            func: async (_ctx, data) => {
                monitor.log(
                    `DELETE /examples/parents ${data.id}, ${data.favoriteProvider}`,
                );
                // politely inform the grandparent resource we're no longer
                // dependent on it
                grandparents.removeDependent(
                    (d) => d.id == data.grandparentId,
                    `parents-${data.id}`,
                );
            },
        },
    });

    // now just add a simple test that get's a parent

    registry.register({
        name: "examples get_parent aws",
        suite: "parents",
        dependsOn: ["grandparents"],
        priority: Priority.Normal,
        func: async (ctx: TestContext) => {
            await parents.findDataAndCall(
                { createArgs: { favoriteProvider: "aws" } },
                ctx,
                (data) => {
                    monitor.log(`GET /examples/parents ${data.id}`);
                },
            );
        },
    });

    return parents;
};

// This is the final data type. The whole point of making a third one is to test
// that sorting / ordering works
type ChildData = {
    id: string;
    name: string;
    parentId: string;
    favoriteProvider: string;
};

type NewChildArgs = { favoriteProvider: string };

type Children = ResourceManager<ChildData, NewChildArgs>;

export const createChildren = (monitor: SelfTestMonitor, registry: TestRegistry): Children => {
    const parents = createParents(monitor, registry);

    const children = registry.newResourceManager<ChildData, NewChildArgs>({
        resourceName: "children",
        dependsOn: ["parents"],
        create: {
            testName: (args) =>
                `examples create_child ${args.favoriteProvider}`,
            // these are all the cases we want to register - meaning they'll be
            // callable from the command line directly, as well as when the
            // resource manager's create function is used.
            testCases: [
                { favoriteProvider: "aws" },
                { favoriteProvider: "azure" },
            ],
            func: (ctx, createArgs) => {
                return parents.findStateAndCall(
                    {
                        createArgs,
                    },
                    ctx,
                    (state) => {
                        monitor.log(
                            `POST /examples/children (using parent id=${state.data.id})`,
                        );
                        const result = {
                            favoriteProvider: createArgs.favoriteProvider,
                            parentId: state.data.id,
                            id: monitor.createArbitraryName(),
                            name: monitor.createArbitraryName(),
                        };
                        monitor.log(`   result id = ${result.id}`);
                        state.dependents.push(`children-${result.id}`);
                        return result;
                    },
                );
            },
        },
        delete: {
            testName: (args) =>
                `examples delete_child ${args.favoriteProvider}`,
            testCases: [
                { favoriteProvider: "aws" },
                { favoriteProvider: "azure" },
            ],
            func: async (_ctx, data) => {
                monitor.log(`DELETE /examples/children ${data.id}`);
                parents.removeDependent(
                    (d) => d.id == data.parentId,
                    `children-${data.id}`,
                );
            },
        },
    });

    registry.register({
        name: "examples get_child aws",
        suite: "children",
        dependsOn: ["parents"],
        priority: Priority.Normal,
        func: async (ctx: TestContext) => {
            await children.findDataAndCall(
                { createArgs: { favoriteProvider: "aws" } },
                ctx,
                (data) => {
                    monitor.log(`GET /examples/child ${data.id}`);
                },
            );
        },
    });

    return children;
};
