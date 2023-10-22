// In this ficticious example, we create "containers" and "apps".
// "apps" live inside "containers", but we need to test both resources.
import { abort } from "process";
import * as chai from "chai";
import { Command } from "@commander-js/extra-typings";
import * as p2 from "piilop";
import { Client, getContainers }  from "./client";

const client = new Client();

type ContainerData = {
    id: string;
    os: string;
};

export type ContainerArgs = { os: string };

export const Containers = p2.resource<ContainerData, ContainerArgs>(
    "Containers",
    (r) => {
        r.create(
            async (
                _ctx: p2.TestContext,
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
        );

        // regardless of what happens, make sure we create ubuntu and linux
        // containers for the purposes of testing; this creates two new
        // test methods which will call `create` defined above.
        r.addCreateTests(
            (args) => `create container ${args.os}`,
            { os: "ubuntu" }, { os: "windows" },
        );
        r.delete(async (_ctx, data) => {
            await client.DeleteContainer(data.id);
        });
        // test that ubuntu containers can be deleted. Don't bother testing
        // anything else (though "clean" will still clean these up)
        r.addDeleteTests(
            (args) => `delete container ${args.os}`,
            { os: "ubuntu" }
        );

        p2.test("test we can get Ubuntu containers", async (ctx) => {
            const container = await Containers.getOrCreate0(
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
        });
    }
);

type AppData = {
    containerId: string;
    id: string;
    os: string;
    pkgName: string;
};

export type AppArgs = { pkgName: string, os: string };


export const Apps = p2.resource<AppData, AppArgs>(
    "Apps",
    (r) => {
        p2.dependsOn("Containers"); // makes the delete tests for this run _before_ Container's delete tests
        r.create(
            async (
                ctx: p2.TestContext,
                args: AppArgs
            ): Promise<AppData> => {
                // finds or creates a container we need
                const container = await Containers.findState(
                    {createArgs: { os:  args.os} },
                    ctx
                );
                const appId = client.CreateApp(container.data.id, args.pkgName);
                // test the app looks like we expect
                const result = await client.GetApp(container.data.id, appId);
                chai.assert.equal(appId, result.id);
                chai.assert.equal(container.data.id, result.parentContainer);
                chai.assert.equal(args.pkgName, result.pkgName);
                // when the container is returned to us, it is "locked" meaning
                // it will not be deleted out from under us until after this
                // function is finished running. However, since we're creating
                // a resource inside of it, we don't want it to go away until
                // this container is gone, so we let it know it has a dependent
                // resource.
                container.dependents.push(`app-${appId}`);
                return {
                    containerId: container.data.id,
                    id: appId,
                    os: args.os,
                    pkgName: args.pkgName,
                };
            }
        );

        r.addCreateTests(
            (args) => `create app on os ${args.os}, pkg name ${args.pkgName}`,
            { os: "ubuntu", pkgName: "nodejs" }, { os: "windows", pkgName: "skifree" }, { os: "macos", pkgName: "GarageBand" },
        );

        r.delete(async (_ctx, data) => {
            client.DeleteApp(data.containerId, data.id);
            // tell the container that this app is no longer a dependent
            Containers.removeDependent(
                (d) => d.id == data.containerId,
                `app-${data.id}`,
            );
        });
        r.addDeleteTests(
            (args) => `delete app on os ${args.os}, pkg name ${args.pkgName}`,
            { os: "ubuntu", pkgName: "nodejs" },
            { os: "ubuntu", pkgName: "golang" },
            { os: "ubuntu", pkgName: "python" },
        );

        p2.test("test Python on Ubuntu", async (ctx) => {
            const app = await Apps.findData(
                {createArgs: { os: "ubuntu", pkgName: "python"} },
                ctx
            );
            const appResult = await client.GetApp(app.containerId, app.id);
            const containerResult = await client.GetContainer(app.containerId);
            chai.assert.equal("ubuntu", containerResult.operatingSystem);
            chai.assert.equal(app.containerId, appResult.parentContainer);
            chai.assert.equal("python", appResult.pkgName);
        });

        p2.test("test Go on Ubuntu", async (ctx) => {
            const app = await Apps.findData(
                {createArgs: { os: "ubuntu", pkgName: "golang"} },
                ctx
            );
            const appResult = await client.GetApp(app.containerId, app.id);
            const containerResult = await client.GetContainer(app.containerId);
            chai.assert.equal("ubuntu", containerResult.operatingSystem);
            chai.assert.equal(app.containerId, appResult.parentContainer);
            chai.assert.equal("golang", appResult.pkgName);
        });

        p2.test("test Mpx Play on FreeDOS", async (ctx) => {
            const app = await Apps.findData(
                {createArgs: { os: "freedos", pkgName: "mpxplay"} },
                ctx
            );
            const appResult = await client.GetApp(app.containerId, app.id);
            const containerResult = await client.GetContainer(app.containerId);
            chai.assert.equal("freedos", containerResult.operatingSystem);
            chai.assert.equal(app.containerId, appResult.parentContainer);
            chai.assert.equal("mpxplay", appResult.pkgName);
        });
    }
);


const program = new Command("hello-world");

program
    .command("test")
    .action(async (_options) => {
        const main = new p2.TestMain(p2.registry);
        await Promise.all([
            main.runTest("", 10),
        ]
        );
        console.log("Test finished. Here are the containers created:");
        const containers = getContainers();
        for (const c of containers) {
            console.log(`container os = ${c.operatingSystem}, apps = ${Object.values(c.apps).map(a => a.pkgName)}`);
        }

        main.registry.getResourceManager().info();

    });

program
    .command("list")
    .action(async (_options) => {
        const main = new p2.TestMain(p2.registry);
        main.showTestList();
    });

program.parse();