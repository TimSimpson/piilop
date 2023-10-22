import { dependsOn, resource, randomName, test } from "../../../naf";
import { providers, networks } from "../infra/networks";

export { providers } from "../infra/networks";

type ClusterData = {
    id: string;
    name: string;
    networkId: string;
    provider: string;
};

type NewClusterArgs = {
    provider: string;
};

export const clusters = resource<ClusterData, NewClusterArgs>(
    "clusters",
    (r) => {
        dependsOn("networks");

        r.create(async (ctx, args) => {
            const network = await networks.findState(
                { createArgs: { provider: args.provider } },
                ctx,
            );
            console.log("creating Cluster \n");
            const cluster = {
                id: randomName(),
                name: randomName(),
                networkId: network.data.id,
                provider: "aws",
            };
            network.dependents.push(`cluster-${cluster.id}`);
            return cluster;
        });

        r.delete(async (_ctx, data) => {
            console.log(`deleting backup ${data.id}\n`);
        });

        r.addCreateTests(
            (args) => `mesdb create_cluster ${args.provider}`,
            ...providers,
        );

        r.addDeleteTests(
            (args) => `mesdb delete_cluster ${args.provider}`,
            ...providers,
        );

        test("mesdb get_cluster aws", async (ctx) => {
            const cluster = await clusters.findData(
                { createArgs: { provider: "aws" } },
                ctx,
            );
            console.log(`I am getting a cluster ${cluster}\n`);
        });
    },
);
