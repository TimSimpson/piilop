// In this ficticious example, we create "containers" and "apps".
// "apps" live inside "containers", but we need to test both resources.
import { abort } from "process";
import * as chai from "chai";
import { Command } from "@commander-js/extra-typings";
import * as p2 from "piilop";
import { Client }  from "./client";

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
                const id = client.CreateContainer(args.os);
                const a = {
                    id,
                    os: args.os,
                };
                // before accepting the new container, test that it's valid
                const result = client.GetContainer(id);
                chai.assert.equal(id, result.id);
                chai.assert.equal(args.os, result.operatingSystem);
                return a;
            }
        );

        // regardless of what happens, make sure we create ubuntu and linux
        // containers for the purposes of testing; this creates two new
        // test methods which will call `create` defined above.
        r.addCreateTests(
            (args) => `create_a ${args.os}`,
            { os: "ubuntu" }, { os: "windows" },
        );
        r.delete(async (_ctx, data) => {
            client.DeleteContainer(data.id);
        });
        // test that ubuntu containers can be deleted. Don't bother testing
        // anything else (though "clean" will still clean these up)
        r.addDeleteTests(
            (args) => `delete_a ${args.os}`,
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
                const result = client.GetApp(container.data.id, appId);
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
            (args) => `create_a ${args.os}`,
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
            (args) => `delete_a ${args.os}`,
            { os: "ubuntu", pkgName: "nodejs" }
        );

        p2.test("test Mpx Play on FreeDOS", async (ctx) => {
            const app = await Apps.findData(
                {createArgs: { os: "freedos", pkgName: "mpxplay"} },
                ctx
            );
            const appResult = client.GetApp(app.containerId, app.id);
            const containerResult = client.GetContainer(app.containerId);
            chai.assert.equal("freedos", containerResult.operatingSystem);
            chai.assert.equal(app.containerId, appResult.parentContainer);
            chai.assert.equal("mpxplay", appResult.pkgName);
        });
    }
);


const program = new Command("hello-world");

program
    .command("test")
    .option("-t, --testName <name>", "test name")
    .action(async (options) => {
        const main = new p2.TestMain(p2.registry);
        let name = options.testName;
        await main.runTest(name);
    });
program.parse();