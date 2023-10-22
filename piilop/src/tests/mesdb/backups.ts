import { dependsOn, randomName, resource, test } from "naf";
import { providers, clusters } from "./clusters";

type BackupData = {
    id: string;
    name: string;
    networkId: string;
    provider: string;
    sourceClusterId: string;
};

type NewBackupArgs = {
    provider: string;
};

const backups = resource<BackupData, NewBackupArgs>("backups", (r) => {
    dependsOn("clusters");
    r.create(async (ctx, args) => {
        const cluster = await clusters.findState(
            { createArgs: { provider: args.provider } },
            ctx
        );
        console.log("creating Cluster \n");
        const backup = {
            id: randomName(),
            name: randomName(),
        networkId: cluster.data.id,
            provider: "aws",
            sourceClusterId: cluster.data.id,
        };
        // throw new Error("oh no! AN ERROR!");
        cluster.dependents.push(`backup-${backup.id}`);
        return backup;
    });

    r.delete(async (_ctx, data) => {
        console.log(`Delete backup ${data.id}`);
    });

    r.addCreateTests(
        (args) => `mesdb create_backup ${args.provider}`,
        ...providers
    );

    r.addDeleteTests(
        (args) => `mesdb delete_backup ${args.provider}`,
        ...providers
    );

    test("mesdb get_backup aws", async (ctx) => {
        const backup = await backups.findData(
            { createArgs: { provider: "aws" } },
            ctx
        );
        console.log(`I am getting a backup ${backup}\n`);
    });
});
