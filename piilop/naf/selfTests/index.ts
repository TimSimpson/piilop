import * as chai from "chai";
import { selfTests as baseTests } from "../core/baseTests";
import { selfTests as runnerTests } from "../runner/selfTests";
import { selfTests as sugarTests } from "../sugar/selfTests";

export const selfTests = async () => {
    chai.config.showDiff = true;
    chai.config.truncateThreshold = 0;

    await baseTests();
    await runnerTests();
    await sugarTests();

    console.log(`The self test passed. Congrats!`);
};
