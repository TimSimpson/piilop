import type { ITestContext } from "./base";
import { Priority, TestEntry } from "./registry";

const debugLog = (_msg: string) => {
    // console.log(`DEBUG: ${msg}`);
};

export interface TestRunnerItem<Ctx extends ITestContext> {
    entry: TestEntry<Ctx, any>;
    dependents: this[];
    dependsOn: this[];
}

export const createRunnerList = <
    Ctx extends ITestContext,
    TRI extends TestRunnerItem<Ctx>,
>(
    entries: TestEntry<Ctx, any>[],
    createTestRunnerItem: (entry: TestEntry<Ctx, any>) => TRI,
): TRI[] => {
    // clear the list of all dependency info
    const initialList: TRI[] = [];
    for (const entry of entries) {
        const newEntry = createTestRunnerItem(entry);
        newEntry.dependents = [];
        newEntry.dependsOn = [];
        initialList.push(newEntry);
    }

    const dependsOn = (a: TestRunnerItem<Ctx>, b: TestRunnerItem<Ctx>) => {
        if (b.entry.priority != Priority.Last) {
            a.dependsOn.push(b);
            b.dependents.push(a);
        } else {
            // if the thing we depend on is marked with priority last, we
            // switch gears and tell IT to depends on US
            b.dependsOn.push(a);
            a.dependents.push(b);
        }
    };
    for (let index = 0; index < initialList.length; ++index) {
        const element = initialList[index];
        // iterate through the string dependsOn lists, and convert them into
        // actual dependency information we can use when sorting this
        for (const dep of element.entry.dependsOn) {
            let found = false;
            for (let index2 = 0; index2 < initialList.length; ++index2) {
                if (index2 == index) {
                    continue;
                }
                const element2 = initialList[index2];
                if (
                    dep == element2.entry.suite ||
                    element2.entry.name.startsWith(dep)
                ) {
                    found = true;
                    dependsOn(element, element2);
                }
            }
            if (!found) {
                throw new Error(
                    `Error: test "${element.entry.name}" has a dependency "${dep}" which was not found.`,
                );
            }
        }
        if (element.entry.priority == Priority.Last) {
            for (const element2 of initialList) {
                if (element2.entry.priority != Priority.Last) {
                    dependsOn(element, element2);
                }
            }
        }
    }

    // Now that we have added the dependency info, do a topological sort

    // figure out what can run first
    let noDepsList: TRI[] = [];
    for (const element of initialList) {
        if (element.dependsOn.length == 0) {
            noDepsList.push(element);
        }
    }
    const sortedList: TRI[] = [];
    while (noDepsList.length > 0) {
        const noDep = noDepsList[0];
        debugLog(
            `noDepdsList.length = ${noDepsList.length}, looking at ${noDep.entry.name}`,
        );
        noDepsList = noDepsList.slice(1);
        sortedList.push(noDep);
        for (const entry of noDep.dependents) {
            debugLog(`   peeping ${entry.entry.name}`);
            // remove this entries depends on clause, since at this point
            // it will be run
            const index = entry.dependsOn.findIndex((e) => e === noDep);
            debugLog(
                `   the depends on length = ${entry.dependsOn.length}, index=${index}`,
            );
            entry.dependsOn = entry.dependsOn
                .slice(0, index)
                .concat(entry.dependsOn.slice(index + 1));
            debugLog(
                `   the depends on length is now = ${entry.dependsOn.length}`,
            );
            if (entry.dependsOn.length == 0) {
                debugLog(`pushin'`);
                noDepsList.push(entry);
            }
        }
        noDep.dependents = [];
    }

    // check for cycles
    for (const element of initialList) {
        debugLog(`element.entry.name=${element.entry.name}`);
        if (element.dependsOn.length != 0) {
            throw new Error(
                `Error sorting tests: a cycle appears to exist between ${element.entry.name} and ${element.dependsOn[0].entry.name}`,
            );
        }
    }

    for (const element of sortedList) {
        debugLog(`SORT element.entry.name=${element.entry.name}`);
    }

    if (sortedList.length != initialList.length) {
        throw new Error(
            `Error sorting tests: the final sorted length (${sortedList.length}) did not equal the original length (${initialList.length})`,
        );
    }
    return sortedList;
};
