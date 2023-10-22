import * as chai from "chai";
import { Priority, ResourceManager, TestContext, TestRegistry } from "../../../naf/runner";
import { FakeSaasServiceState } from "./client";
import { Containers } from "./containers";

type AppData = {
    containerId: string;
    id: string;
    os: string;
    pkgName: string;
};

export type AppArgs = { pkgName: string, os: string };

type Apps = ResourceManager<AppData, AppArgs>;

export const createApps = (service: FakeSaasServiceState, registry: TestRegistry, containers: Containers): Apps => {
    const suiteName = "Apps";
    const dependsOn = ["Containers"];

    // Here we create a resource manager. Typically it's a global variable so the various tests
    // can grab it.
    const apps = registry.newResourceRegistry<
        AppData,
        AppArgs
    >(suiteName);


    const client = service.newClient();

    apps.registerWrappedCreateFunc(
        (args) => `create app on os ${args.os}, pkg name ${args.pkgName}`,
        async (
            ctx: TestContext,
            args: AppArgs
        ): Promise<AppData> => {
            // finds or creates a container we need
                const container = await containers.findState(
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
    )

    registry.registerCreateTests(
        apps,
        (args) => `create app on os ${args.os}, pkg name ${args.pkgName}`,
        dependsOn,
        Priority.First,
        suiteName,
        { os: "ubuntu", pkgName: "nodejs" }, { os: "windows", pkgName: "skifree" }, { os: "macos", pkgName: "GarageBand" },
    );

    apps.registerDeleteFunc(async (_ctx, data) => {
        client.DeleteApp(data.containerId, data.id);
        // tell the container that this app is no longer a dependent
        containers.removeDependent(
            (d) => d.id == data.containerId,
            `app-${data.id}`,
        );
    })

    registry.registerDeleteTests(
        apps,
        (args) => `delete app on os ${args.os}, pkg name ${args.pkgName}`,
        dependsOn, Priority.First,
        suiteName,
        { os: "ubuntu", pkgName: "nodejs" },
        { os: "ubuntu", pkgName: "golang" },
        { os: "ubuntu", pkgName: "python" },);

    registry.register({
        name: "test Python on Ubuntu",
        suite: suiteName,
        dependsOn: dependsOn,
        priority: Priority.Normal,
        func: async (ctx: TestContext): Promise<void> => {
            const app = await apps.findData(
                {createArgs: { os: "ubuntu", pkgName: "python"} },
                ctx
            );
            const appResult = await client.GetApp(app.containerId, app.id);
            const containerResult = await client.GetContainer(app.containerId);
            chai.assert.equal("ubuntu", containerResult.operatingSystem);
            chai.assert.equal(app.containerId, appResult.parentContainer);
            chai.assert.equal("python", appResult.pkgName);
        }
    });

    registry.register({
        name: "test Go on Ubuntu",
        suite: suiteName,
        dependsOn: dependsOn,
        priority: Priority.Normal,
        func: async (ctx: TestContext): Promise<void> => {
            const app = await apps.findData(
                {createArgs: { os: "ubuntu", pkgName: "golang"} },
                ctx
            );
            const appResult = await client.GetApp(app.containerId, app.id);
            const containerResult = await client.GetContainer(app.containerId);
            chai.assert.equal("ubuntu", containerResult.operatingSystem);
            chai.assert.equal(app.containerId, appResult.parentContainer);
            chai.assert.equal("golang", appResult.pkgName);
        }
    });

    registry.register({
        name: "test Mpx Play on FreeDOS",
        suite: suiteName,
        dependsOn: dependsOn,
        priority: Priority.Normal,
        func: async (ctx: TestContext): Promise<void> => {
            const app = await apps.findData(
                {createArgs: { os: "freedos", pkgName: "mpxplay"} },
                ctx
            );
            const appResult = await client.GetApp(app.containerId, app.id);
            const containerResult = await client.GetContainer(app.containerId);
            chai.assert.equal("freedos", containerResult.operatingSystem);
            chai.assert.equal(app.containerId, appResult.parentContainer);
            chai.assert.equal("mpxplay", appResult.pkgName);
        }
    });

    return apps;
}