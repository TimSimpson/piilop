import { abort } from "process";
import * as chai from "chai";
import { resource, randomName, test, TestContext } from "../../../piilop";

export type NetworkData = {
    id: string;
    name: string;
    provider: string;
};

export type NewNetworkArgs = { provider: string };

export const providers = [
    { provider: "aws" },
    { provider: "azure" },
    { provider: "gcp" },
];

export const networks = resource<NetworkData, NewNetworkArgs>(
    "networks",
    (r) => {
        // dependsOn()
        r.create(
            async (
                _ctx: TestContext,
                args: NewNetworkArgs,
            ): Promise<NetworkData> => {
                console.log("creating network \n");
                const network = {
                    id: randomName(),
                    name: randomName(),
                    provider: args.provider,
                };
                return network;
            },
        );

        r.addCreateTests(
            (args) => `create_network ${args.provider}`,
            ...providers,
        );
        r.delete(async (_ctx, data) => {
            console.log(`deleting network ${data.id}\n`);
        });
        r.addDeleteTests(
            (args) => `delete_network ${args.provider}`,
            ...providers,
        );

        test("get_network", async (ctx) => {
            console.log("I am using the network \n");

            const network = await networks.getOrCreate0(
                ctx,
                (network): boolean => network.data.provider == "aws",
                { provider: "aws" },
                (network) => {
                    network.lockedBy = "infra get network";
                },
            );
            if (network == null) {
                abort();
            }

            chai.assert.equal(network.data.provider, "aws");

            // assert(network.data.id == "12345");
            network.lockedBy = null;
        });
    },
);
