import * as fs from "fs/promises";
import * as fsSync from "fs";
import * as os from "os";
import * as path from "path";
import { registry, TestMain } from "../../piilop";

// Every test we're running has to get imported here or it won't be added to
// the global registry.

import "./infra/networks";
import "./mesdb/backups";
import "./mesdb/clusters";

export const runTests = async (testName?: string): Promise<void> => {
    const main = new TestMain(registry);
    await main.runTest(testName);
};

export const status = () => {
    const main = new TestMain(registry);
    main.showTestList();
};

export const clear = () => {
    const resourceManager = registry.getResourceManager();
    resourceManager.clear();
};

async function createDirIfMissing(dir: string) {
    if (!fsSync.existsSync(dir)) {
        await fs.mkdir(dir, { recursive: true });
    }
}

const findSaveFileLocation = async (filePath?: string): Promise<string> => {
    if (filePath === undefined) {
        const rootPath = path.join(os.homedir(), ".naft-tests");
        await createDirIfMissing(rootPath);
        return path.join(rootPath, "naftTestData.json");
    }
    return filePath;
};

export const info = () => {
    const resourceManager = registry.getResourceManager();
    resourceManager.info();
};

export const load = async (filePath?: string) => {
    const realFilePath = await findSaveFileLocation(filePath);
    try {
        const contents = await fs.readFile(realFilePath);
        const jsonObj = JSON.parse(contents.toString());

        const resourceManager = registry.getResourceManager();
        resourceManager.load(jsonObj.resourceManager);
    } catch (err) {
        console.log(`Failed to load data from ${realFilePath}!`);
    }
};

export const save = async (filePath?: string) => {
    const realFilePath = await findSaveFileLocation(filePath);

    console.log(`Saving test data to ${realFilePath}...`);
    const resourceManager = registry.getResourceManager();
    const rmJsonObj = resourceManager.save();
    const jsonObj = {
        isNew: false,
        resourceManager: rmJsonObj,
    };
    const contents = JSON.stringify(jsonObj);
    await fs.writeFile(realFilePath, contents);
};
