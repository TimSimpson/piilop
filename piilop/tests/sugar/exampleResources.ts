import * as chai from "chai";
import type * as runner from "../../naf/runner";
import * as dsl from "../../naf/sugar/dsl";

type GrandparentData = {
    id: string; // this must be present on ALL resources, and be unique
    name: string; // this can be anything
    favoriteProvider: string; // they're favorite cloud provider
};

type NewGrandparentArgs = { favoriteProvider: string };

type Grandparents = runner.ResourceManager<GrandparentData, NewGrandparentArgs>;

export const asyncAction = async () => {};

export const createGrandParentsUsingWrappedCreateAndDeletes = (
    registry: runner.TestRegistry
): Grandparents => {
    const { resource, suite, test } = dsl.createDslFuncs(registry);

    const grandparents = resource<GrandparentData, NewGrandparentArgs>(
        "grandparents",
        (r) => {
            r.createWrapped(
                (args: NewGrandparentArgs) =>
                    `create_grandparents ${args.favoriteProvider}`,
                async (
                    ctx: runner.TestContext,
                    args: NewGrandparentArgs
                ): Promise<GrandparentData> => {
                    ctx.log(`POST examples/grandparents`);
                    await asyncAction();
                    const grandparent = {
                        id: ctx.createArbitraryName(),
                        name: ctx.createArbitraryName(),
                        favoriteProvider: args.favoriteProvider,
                    };
                    return grandparent;
                }
            );

            r.deleteWrapped(
                (args: NewGrandparentArgs) =>
                    `delete_grandparents ${args.favoriteProvider}`,
                async (ctx, data) => {
                    ctx.log(`DELETE examples/grandparents/${data.id}`);
                }
            );
        }
    );

    suite("grandparents", () => {
        test("get_grandparent aws", (ctx: runner.TestContext): Promise<void> => {
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
                    ctx.log(`GET examples/grandparents/${grandparent.id}`);
                    chai.assert.equal(grandparent.favoriteProvider, "aws");
                }
            );
        });
    });

    return grandparents;
};

export const createGrandParents = (
    registry: runner.TestRegistry
): Grandparents => {
    const { resource, suite, test } = dsl.createDslFuncs(registry);

    const grandparents = resource<GrandparentData, NewGrandparentArgs>(
        "grandparents",
        (r) => {
            r.create(
                async (
                    ctx: runner.TestContext,
                    args: NewGrandparentArgs
                ): Promise<GrandparentData> => {
                    ctx.log(`POST examples/grandparents`);
                    await asyncAction();
                    const grandparent = {
                        id: ctx.createArbitraryName(),
                        name: ctx.createArbitraryName(),
                        favoriteProvider: args.favoriteProvider,
                    };
                    return grandparent;
                }
            );

            r.delete(async (ctx, data) => {
                ctx.log(`DELETE examples/grandparents/${data.id}`);
            });
        }
    );

    suite("grandparents", () => {
        test("get_grandparent aws", (ctx: runner.TestContext): Promise<void> => {
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
                    ctx.log(`GET examples/grandparents/${grandparent.id}`);
                    chai.assert.equal(grandparent.favoriteProvider, "aws");
                }
            );
        });
    });

    return grandparents;
};

// This is a second data type. Not much is different from GrandparentData above,
// however this has a reference to it using the ID, much like the real
// resources in more complex systems.
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

type Parents = runner.ResourceManager<ParentData, NewParentArgs>;

export const createParents = (registry: runner.TestRegistry): Parents => {
    const grandparents = createGrandParents(registry);

    const {
        addCreateTests,
        addDeleteTests,
        dependsOn,
        resource,
        suite,
        test,
    } = dsl.createDslFuncs(registry);

    const parents = resource<ParentData, NewParentArgs>("parents", (r) => {
        dependsOn("grandparents");

        r.create(
            async (
                ctx: runner.TestContext,
                createArgs: NewParentArgs
            ): Promise<ParentData> => {
                // here we use the grandparent's resource to get a grand parent
                // first. We use `findState` because we have to mark the fact
                // that the grandParent now has a dependent.
                return grandparents.findStateAndCall(
                    {
                        createArgs,
                    },
                    ctx,
                    (state) => {
                        ctx.log(
                            `POST /examples/parents (using grandparent id=${state.data.id}, ${createArgs.favoriteProvider}, ${state.data.favoriteProvider})`
                        );
                        const result = {
                            favoriteProvider: createArgs.favoriteProvider,
                            grandparentId: state.data.id,
                            id: ctx.createArbitraryName(),
                            name: ctx.createArbitraryName(),
                        };
                        ctx.log(`   result id = ${result.id}`);
                        state.dependents.push(`parents-${result.id}`);
                        return result;
                    }
                );
            }
        );

        r.delete(async (ctx, data) => {
            ctx.log(
                `DELETE /examples/parents ${data.id}, ${data.favoriteProvider}`
            );
            // politely inform the grandparent resource we're no longer
            // dependent on it
            grandparents.removeDependent(
                (d) => d.id == data.grandparentId,
                `parents-${data.id}`
            );
        });
    });

    suite("parents", () => {
        dependsOn("grandparents"),
            addCreateTests(
                parents,
                (args: NewParentArgs) =>
                    `create_parent ${args.favoriteProvider}`,
                { favoriteProvider: "aws" },
                { favoriteProvider: "azure" }
            );
        addDeleteTests(
            parents,
            (args: NewParentArgs) => `delete_parent ${args.favoriteProvider}`,
            { favoriteProvider: "aws" },
            { favoriteProvider: "azure" }
        );
        // priority(Priority.Normal)
        test("get_parent aws", async (ctx) => {
            await parents.findDataAndCall(
                { createArgs: { favoriteProvider: "aws" } },
                ctx,
                (data) => {
                    ctx.log(`GET /examples/parents ${data.id}`);
                }
            );
        });
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

type Children = runner.ResourceManager<ChildData, NewChildArgs>;

export const createChildren = (registry: runner.TestRegistry): Children => {
    const parents = createParents(registry);

    const { dependsOn, resource, test } = dsl.createDslFuncs(registry);

    const children = resource<ChildData, NewGrandparentArgs>(
        "children",
        (r) => {
            dependsOn("parents");
            r.create((ctx, createArgs) => {
                return parents.findStateAndCall(
                    {
                        createArgs,
                    },
                    ctx,
                    (state) => {
                        ctx.log(
                            `POST /examples/children (using parent id=${state.data.id})`
                        );
                        const result = {
                            favoriteProvider: createArgs.favoriteProvider,
                            parentId: state.data.id,
                            id: ctx.createArbitraryName(),
                            name: ctx.createArbitraryName(),
                        };
                        ctx.log(`   result id = ${result.id}`);
                        state.dependents.push(`children-${result.id}`);
                        return result;
                    }
                );
            });
            r.addCreateTests(
                (args) => `create_child ${args.favoriteProvider}`,
                { favoriteProvider: "aws" },
                { favoriteProvider: "azure" }
            );
            r.delete(async (ctx, data) => {
                ctx.log(`DELETE /examples/children ${data.id}`);
                parents.removeDependent(
                    (d) => d.id == data.parentId,
                    `children-${data.id}`
                );
            });

            r.addDeleteTests(
                (args) => `delete_child ${args.favoriteProvider}`,
                { favoriteProvider: "aws" },
                { favoriteProvider: "azure" }
            );

            test("get_child aws", async (ctx) => {
                await children.findDataAndCall(
                    { createArgs: { favoriteProvider: "aws" } },
                    ctx,
                    (data) => {
                        ctx.log(`GET /examples/child ${data.id}`);
                    }
                );
            });

            test("get_child azure", async (ctx) => {
                const child = await children.findData(
                    { createArgs: { favoriteProvider: "azure" } },
                    ctx
                );
                ctx.log(`GET /examples/child ${child.id}`);
            });

            test("get_child azure 2", async (ctx) => {
                const child = await children.findData(
                    { createArgs: { favoriteProvider: "azure" } },
                    ctx
                );
                ctx.log(`GET /examples/child ${child.id}`);
            });
        }
    );
    return children;
};
