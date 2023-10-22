
// Represents an rich client for some service that can provision containers and
// install apps on those containers.

const { randomUUID } = require('crypto');
import {setTimeout} from 'timers/promises';

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

type ContainerLookup = {[key:string]: Container};

const fakeSleep = async () => {
    setTimeout(10);
}

export class FakeSaasServiceState {
    state: {[key:string]: Container}

    constructor() {
        this.state = {};
    }

    public getApps(): App[] {
        const result = [];
        for (const container of this.getContainers()) {
            result.push(...Object.values(container.apps));
        }
        return result;
    }

    public getContainers(): Container[] {
        return Object.values(this.state);
    }

    public newClient(): Client {
        return new Client(this.state);
    }
}

export class Client {
    containers: ContainerLookup

    constructor(state: ContainerLookup) {
        this.containers = state;
    }

    public CreateApp(containerId: ContainerId, pkgName: string): AppId {
        const container = this.containers[containerId];
        console.log(`installing an app on container ${containerId} (os = ${container.operatingSystem}, pkg = ${pkgName})`);
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

    public async CreateContainer(operatingSystem: string): Promise<ContainerId> {
        const id = randomUUID();
        console.log(`creating a container ${id} with os ${operatingSystem}`);
        this.containers[id] = {
            apps: {},
            id,
            operatingSystem
        };
        await fakeSleep();
        return id;
    }

    public async DeleteApp(containerId: ContainerId, appId: AppId) {
        if (this.containers[containerId] === undefined) {
            throw new Error(`container ID ${containerId} not found!`);
        }
        if (this.containers[containerId].apps[appId] === undefined) {
            throw new Error(`app ID ${appId} not found!`);
        }
        console.log(`deleting app ${appId} (container os=${this.containers[containerId].operatingSystem}, pkg=${this.containers[containerId].apps[appId].pkgName})`);
        await fakeSleep();
        delete this.containers[containerId].apps[appId];
    }

    public async DeleteContainer(containerId: ContainerId) {
        console.log(`MARIO getting delete container call for ${containerId}`);
        if (this.containers[containerId] === undefined) {
            throw new Error(`container ID ${containerId} not found!`);
        }
        const c = this.containers[containerId];
        const appCount = Object.values(c.apps).length
        console.log(`deleting container ${containerId} (os=${c.operatingSystem}, app count=${appCount})`);
        await fakeSleep();
        delete this.containers[containerId];
    }

    public async GetApp(containerId: ContainerId, appId: AppId) : Promise<App> {
        const container = this.containers[containerId];
        const apps = container.apps;
        await fakeSleep();
        return apps[appId];
    }

    public async GetContainer(containerId: ContainerId) : Promise<Container> {
        await fakeSleep();
        return this.containers[containerId];
    }
}
