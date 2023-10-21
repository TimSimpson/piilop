
// Represents an rich client for some service that can provision containers and
// install apps on those containers.

const { randomUUID } = require('crypto');

type AppId = string;

type App = {
    parentContainer: ContainerId,
    id: AppId,
    pkgName: string,
};

type ContainerId = string;

type Container = {
    apps: { [key: string]: App },
    id : ContainerId,
    operatingSystem: string,
}


const containers: {
    [key: string]: Container;
} = {}


export class Client {
    constructor() {
    }

    public CreateApp(containerId: ContainerId, pkgName: string): AppId {
        console.log(`installing an app on container ${containerId}`);
        const container = containers[containerId];
        const apps = container.apps;
        const id: AppId = randomUUID();
        const app = {
            id,
            parentContainer: containerId,
            pkgName,
         };
        apps[id] = app;
        return id;
    }

    public CreateContainer(operatingSystem: string): ContainerId {
        console.log(`creating a container with os ${operatingSystem}`);
        const id = randomUUID();
        containers[id] = {
            apps: {},
            id,
            operatingSystem
        };
        return id;
    }

    public DeleteApp(containerId: ContainerId, appId: AppId) {
        console.log(`deleting app ${appId}`);
        if (containers[containerId] === undefined) {
            throw new Error(`container ID ${containerId} not found!`);
        }
        if (containers[containerId].apps[appId] === undefined) {
            throw new Error(`app ID ${appId} not found!`);
        }
        delete containers[containerId].apps[appId];
    }

    public DeleteContainer(containerId: ContainerId) {
        console.log(`deleting container ${containerId}`);
        if (containers[containerId] === undefined) {
            throw new Error(`container ID ${containerId} not found!`);
        }
        delete containers[containerId];
    }

    public GetApp(containerId: ContainerId, appId: AppId) : App {
        const container = containers[containerId];
        const apps = container.apps;
        return apps[appId];
    }

    public GetContainer(containerId: ContainerId) : Container {
        return containers[containerId];
    }
}