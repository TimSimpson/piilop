import { abort } from "process";
import * as chai from "chai";
import { Priority, ResourceManager, TestContext, TestRegistry } from "../../../naf/runner";
import { FakeSaasServiceState } from "./client";

type ContainerData = {
    id: string;
    os: string;
};

export type ContainerArgs = { os: string };

export type Containers = ResourceManager<ContainerData, ContainerArgs>;

export const createContainers = (service: FakeSaasServiceState, registry: TestRegistry): Containers => {
    // Here we create a resource manager. Typically it's a global variable so the various tests
    // can grab it.
    const containers = registry.newResourceRegistry<
        ContainerData,
        ContainerArgs
    >("Containers");

    const client = service.newClient();

    containers.registerWrappedCreateFunc(
        (args) => `create container ${args.os}`,
        async (
            _ctx: TestContext,
            args: ContainerArgs
        ): Promise<ContainerData> => {
            const id = await client.CreateContainer(args.os);
            const a = {
                id,
                os: args.os,
            };
            // before accepting the new container, test that it's valid
            const result = await client.GetContainer(id);
            chai.assert.equal(id, result.id);
            chai.assert.equal(args.os, result.operatingSystem);
            return a;
        }
    )

    registry.registerCreateTests(
        containers,
        (args) => `create container ${args.os}`,
        [],
        Priority.First,
        "Containers",
        { os: "ubuntu" }, { os: "windows" },
    );

    containers.registerDeleteFunc(async (_ctx, data) => {
        // There is some nutty regression where the incoming data is wrong here.
        if (data.os != "ubuntu") {
            throw new Error(`The incoming data os is ${JSON.stringify(data)}. How?`);
            //abort();
        }
        await client.DeleteContainer(data.id);
    })

    registry.registerDeleteTests(
        containers,
        (args) => `delete container ${args.os}`,
        [],
        Priority.Last,
        "Containers",
        { os: "ubuntu" }
    );


    registry.register({
        name: "test we can get Ubuntu containers",
        suite: "Containers",
        dependsOn: [],
        priority: Priority.Normal,
        func: async (ctx: TestContext): Promise<void> => {
            const container = await containers.getOrCreate0(
                ctx,
                (container): boolean => container.data.os == "ubuntu",
                { os: "ubuntu" },
                (container) => {
                    container.lockedBy = "testing container GET";
                }
            );
            if (container == null) {
                abort();
            }

            chai.assert.equal(container.data.os, "ubuntu");

            container.lockedBy = null;
        }
    });

    return containers;
}