#!/usr/bin/env node
import { Command } from "@commander-js/extra-typings";
import { clear, info, load, runTests, save, status } from "tests";
import { selfTests } from "../../naf/selfTests";

const program = new Command("naft");

program.option(
    "-f, --file <file>",
    "where to save / load results (typically in ~/.bepsin-tests)"
);

const getFileArg = (): string | undefined =>
    (program.opts() as { file?: string }).file;

const withSaveFile = async (f: CallableFunction) => {
    try {
        await load(getFileArg());
    } catch (err) {
        console.log(`Couldn't read file.`);
    }
    try {
        await f();
    } finally {
        await save(getFileArg());
    }
};

program
    .command("clean")
    .description("delete all known resources created by this test")
    .action(async () => {
        await withSaveFile(() => clear());
    });
program
    .command("clear")
    .description("erase any saved state / progress")
    .action(async () => {
        await withSaveFile(() => clear());
    });
program
    .command("info")
    .description("show all resources the test knows about")
    .action(async () => {
        await withSaveFile(() => info());
    });
program
    .command("selfTests")
    .description("run self tests (tests the tests)")
    .action(async () => {
        await selfTests();
    });
program
    .command("testBase")
    .description("run testBase")
    .action(async () => {
        await selfTests();
    });
program
    .command("status")
    .description("show test status / test list")
    .action(async () => {
        await status();
    });
program
    .command("test")
    .option("-t, --testName <name>", "test name")
    .action(async (options) => {
        let name = options.testName;
        await withSaveFile(() => runTests(name));
    });

program.parse();
