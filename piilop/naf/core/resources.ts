import { ITestContext, wrap } from "./base";
import { objectIsSubsetOf } from "./objectEquality";

export type Data = {
    id: string;
};

type State<D extends Data> = {
    data: D;
    dependents: string[];
    lockedBy: string | null;
};

type DataSearcher<D extends Data> = (data: D) => boolean;
type StateSearcher<D extends Data> = (data: State<D>) => boolean;
type StateModifier<D extends Data> = (data: State<D>) => void;
export type StateCreator<
    Ctx extends ITestContext,
    D extends Data,
    CreateOptions
> = (ctx: Ctx, args: CreateOptions) => Promise<D>;
export type StateDeleter<Ctx extends ITestContext, D extends Data> = (
    ctx: Ctx,
    data: D
) => Promise<void>;

class StateBag<
    Ctx extends ITestContext,
    D extends Data & CreateOptions,
    CreateOptions
> {
    deleted: State<D>[];
    elements: State<D>[];

    constructor() {
        this.deleted = [];
        this.elements = [];
    }

    public add(data: State<D>) {
        this.elements.push(data);
    }

    public clean(ctx: Ctx, deleter: StateDeleter<Ctx, D>) {
        for (const data of this.elements) {
            deleter(ctx, data.data);
        }
        this.elements = [];
    }

    public delete(search: StateSearcher<D>) {
        const index = this.elements.findIndex(search);
        if (index >= 0) {
            this.deleted.push(this.elements[index]);
            this.elements = this.elements
                .splice(0, index)
                .concat(this.elements.splice(index + 1, this.elements.length));
        }
    }

    public get(
        search: StateSearcher<D>,
        modifier: StateModifier<D>
    ): State<D> | null {
        for (const state of this.elements) {
            if (search(state)) {
                modifier(state);
                return state;
            }
        }
        return null;
    }

    public list(): State<D>[] {
        return this.elements;
    }

    public load(jsonObj: any) {
        this.elements = jsonObj.elements;
        this.deleted = jsonObj.deleted;
    }

    public save(): any {
        return {
            elements: this.elements.slice(0),
            deleted: this.deleted.slice(0),
        };
    }
}

export class ResourceManager<
    Ctx extends ITestContext,
    D extends Data & CreateOptions,
    CreateOptions
> {
    bag: StateBag<Ctx, D, CreateOptions>;
    createFunc: StateCreator<Ctx, D, CreateOptions> | null;
    deleteFunc: StateDeleter<Ctx, D> | null;
    name: string;

    constructor(name: string) {
        this.bag = new StateBag();
        this.name = name;
        this.createFunc = null;
        this.deleteFunc = null;
    }

    public clean(ctx: Ctx) {
        if (this.deleteFunc == null) {
            throw new Error("deleter func not set!");
        }
        this.bag.clean(ctx, this.deleteFunc);
    }

    // erases all state!
    public clear() {
        this.bag = new StateBag();
    }

    public async create(
        ctx: Ctx,
        options: CreateOptions,
        modifier: StateModifier<D>
    ): Promise<State<D>> {
        if (this.createFunc == null) {
            throw new Error("createFun calling create");
        }
        return await this.createInternal(
            ctx,
            options,
            modifier,
            this.createFunc
        );
    }

    async createInternal(
        ctx: Ctx,
        options: CreateOptions,
        modifier: StateModifier<D>,
        createFunc: StateCreator<Ctx, D, CreateOptions>
    ): Promise<State<D>> {
        const data = await createFunc(ctx, options);
        const dataState = {
            data: data,
            dependents: [],
            lockedBy: null,
        };
        modifier(dataState);
        this.bag.add(dataState);
        return dataState;
    }

    // Marks a resource as deleted
    public async delete(ctx: Ctx, data: D) {
        if (this.deleteFunc == null) {
            throw new Error("deleteFunc not set");
        }
        await this.deleteFunc(ctx, data);
        this.bag.delete((state: State<D>) => {
            return state.data.id === data.id;
        });
    }

    public async getOrCreateAndDelete(
        ctx: Ctx,
        search: StateSearcher<D>,
        createArgs: CreateOptions
    ) {
        if (this.deleteFunc == null) {
            throw new Error("deleteFunc not set");
        }
        const state = await this.getOrCreate0(
            ctx,
            search,
            createArgs,
            (state: State<D>) => {
                state.lockedBy = "delete";
            }
        );
        await this.delete(ctx, state.data);
    }

    public async getOrCreate0(
        ctx: Ctx,
        search: StateSearcher<D>,
        createArgs: CreateOptions,
        modifier: StateModifier<D>
    ): Promise<State<D>> {
        const state = this.bag.get(search, modifier);
        if (state != null) {
            return state;
        } else {
            return await this.create(ctx, createArgs, modifier);
        }
    }

    // Finds state, locks it (or does whatever is specified by the modifierPre option)
    // and returns. It's up to the caller to "release" the resource somehow.
    public async findStateManual(
        {
            searchData,
            searchState,
            createArgs,
            modifierPre,
        }: {
            searchData?: DataSearcher<D>;
            searchState?: StateSearcher<D>;
            createArgs: CreateOptions;
            modifierPre?: StateModifier<D>;
        },
        ctx: Ctx
    ): Promise<State<D>> {
        if (modifierPre === undefined) {
            modifierPre = (state: State<D>) => {
                state.lockedBy = ctx.currentTestName();
            };
        }
        if (searchData !== undefined) {
            if (searchState !== undefined) {
                throw new Error(
                    "both searchData and searchState cannot be defined at once"
                );
            }
        }
        if (searchState === undefined) {
            if (searchData !== undefined) {
                searchState = (state: State<D>): boolean =>
                    searchData(state.data);
            } else {
                searchState = (state: State<D>): boolean => {
                    if (state.lockedBy != null) {
                        return false;
                    }
                    // TODO(tss): make typeScript figure out CreateOptions must be
                    // a subset of `D`
                    return objectIsSubsetOf(createArgs as any, state.data as any);
                };
            }
        }
        let data = this.bag.get(searchState, modifierPre);
        if (data == null) {
            data = await this.create(ctx, createArgs, modifierPre);
        }
        return data;
    }

    // Finds a resource's state, locks it, calls the given function, and unlocks
    // it.
    public async findStateAndCall<R>(
        {
            searchData,
            searchState,
            createArgs,
            modifierPre,
            modifierPost,
        }: {
            searchData?: DataSearcher<D>;
            searchState?: StateSearcher<D>;
            createArgs: CreateOptions;
            modifierPre?: StateModifier<D>;
            modifierPost?: StateModifier<D>;
        },
        ctx: Ctx,
        f: (data: State<D>) => R
    ): Promise<R> {
        if (modifierPost === undefined) {
            modifierPost = (state: State<D>) => {
                state.lockedBy = null;
            };
        }
        const data = await this.findStateManual(
            {
                searchData,
                searchState,
                createArgs,
                modifierPre,
            },
            ctx
        );
        try {
            const r = await f(data);
            modifierPost(data);
            return r;
        } catch (err) {
            modifierPost(data);
            throw err;
        }
    }

    // Finds the state, and then calls `ctx.defer` to release it.
    public async findState(
        {
            searchData,
            searchState,
            createArgs,
            modifierPre,
            modifierPost,
            releaseLevel,
        }: {
            searchData?: DataSearcher<D>;
            searchState?: StateSearcher<D>;
            createArgs: CreateOptions;
            modifierPre?: StateModifier<D>;
            modifierPost?: StateModifier<D>;
            releaseLevel?: number;
        },
        ctx: Ctx
    ): Promise<State<D>> {
        const rl = releaseLevel === undefined ? 0 : releaseLevel;
        const mp =
            modifierPost === undefined
                ? (state: State<D>) => {
                      state.lockedBy = null;
                  }
                : modifierPost;
        const data = await this.findStateManual(
            {
                searchData,
                searchState,
                createArgs,
                modifierPre,
            },
            ctx
        );
        ctx.defer(rl, () => {
            mp(data);
        });
        return data;
    }

    // Finds a resource's data, locks it, and calls the given function.
    public async findDataAndCall<R>(
        options: {
            searchData?: DataSearcher<D>;
            searchState?: StateSearcher<D>;
            createArgs: CreateOptions;
            modifierPre?: StateModifier<D>;
            modifierPost?: StateModifier<D>;
        },
        ctx: Ctx,
        f: (data: D) => R
    ): Promise<R> {
        return await this.findStateAndCall(options, ctx, (state) =>
            f(state.data)
        );
    }

    // Finds the data, and then calls `ctx.defer` to release it.
    public async findData(
        args: {
            searchData?: DataSearcher<D>;
            searchState?: StateSearcher<D>;
            createArgs: CreateOptions;
            modifierPre?: StateModifier<D>;
            modifierPost?: StateModifier<D>;
            releaseLevel?: number;
        },
        ctx: Ctx
    ): Promise<D> {
        const state = await this.findState(args, ctx);
        return state.data;
    }

    public info(shower: (msg: string) => void) {
        for (const element of this.bag.list()) {
            shower(JSON.stringify(element));
        }
        for (const element of this.bag.deleted) {
            shower(`  deleted: ${JSON.stringify(element)}`);
        }
    }

    public getName() {
        return this.name;
    }

    public load(jsonObj: any) {
        this.bag.load(jsonObj);
    }

    public registerCreateFunc(createFunc: StateCreator<Ctx, D, CreateOptions>) {
        this.createFunc = createFunc;
    }

    public registerDeleteFunc(deleteFunc: StateDeleter<Ctx, D>) {
        this.deleteFunc = deleteFunc;
    }

    /**
     * Registers the create function, but also wraps it so the test context knows
     * it's being entered and exitted. This _could_ be used for reporting when
     * the create function is called, but at this point we might just drop the
     * concept instead.
     */
    public registerWrappedCreateFunc(
        testNameFunc: (arg: CreateOptions) => string,
        createFunc: StateCreator<Ctx, D, CreateOptions>
    ) {
        this.createFunc = wrap(createFunc, { nameFunc: testNameFunc });
    }

    /** This is like the register "wrapped" create func above */
    public registerWrappedDeleteFunc(
        testNameFunc: (arg: CreateOptions) => string,
        deleteFunc: StateDeleter<Ctx, D>
    ) {
        this.deleteFunc = wrap(deleteFunc, { nameFunc: testNameFunc });
    }

    /** searches for data and removes a dependent, if one is found. */
    public removeDependent(searcher: DataSearcher<D>, dependent: string) {
        this.bag.get(
            (state) => searcher(state.data),
            (state) => {
                const index = state.dependents.findIndex((s) => s == dependent);
                if (index >= 0) {
                    state.dependents = state.dependents
                        .slice(0, index)
                        .concat(state.dependents.slice(index + 1));
                }
            }
        );
    }

    public save(): any {
        return this.bag.save();
    }
}

interface IResourceManager<Ctx extends ITestContext> {
    clean: (ctx: Ctx) => void;
    clear: () => void;
    info: (shower: (msg: string) => void) => void;
    getName: () => string;
    load: (jsonObj: any) => void;
    save: () => any;
}

export class ResourceManagerRegistry<Ctx extends ITestContext> {
    lookup: { [key: string]: IResourceManager<Ctx> };

    constructor() {
        this.lookup = {};
    }

    public new<D extends Data & CreateOptions, CreateOptions>(
        name: string
    ): ResourceManager<Ctx, D, CreateOptions> {
        if (this.lookup[name] !== undefined) {
            throw new Error(`resources for ${name} are already defined!`);
        }
        const rm = new ResourceManager<Ctx, D, CreateOptions>(name);
        this.lookup[name] = rm;
        return rm;
    }

    public clean(ctx: Ctx) {
        Object.entries(this.lookup).forEach(([name, rm]) => {
            console.log(`Cleaning all entries in ${name}...`);
            rm.clean(ctx);
        });
    }

    // erases all state!
    public clear() {
        Object.entries(this.lookup).forEach(([_, rm]) => {
            rm.clear();
        });
    }

    public get(name: string): IResourceManager<Ctx> | null {
        const r = this.lookup[name];
        if (r != undefined) {
            return r;
        } else {
            return null;
        }
    }

    public info(shower?: (msg: string) => void) {
        const shower2 =
            shower ||
            ((msg: string) => {
                console.log(msg);
            });
        shower2(`Resource info:`);
        Object.entries(this.lookup).forEach(([name, rm]) => {
            shower2(`${name}:`);
            rm.info(shower2);
        });
    }

    public load(jsonObj: { [key: string]: any }) {
        Object.entries(this.lookup).forEach(([name, rm]) => {
            const val = jsonObj[name];
            if (val === undefined) {
                throw new Error(
                    `error loading ResourceManagerRegistry: data is missing for "${name}" resources`
                );
            }
            rm.load(val);
        });
    }

    public save(): { [key: string]: any } {
        const saveObj: { [key: string]: any } = {};
        Object.entries(this.lookup).forEach(([name, rm]) => {
            saveObj[name] = rm.save();
        });
        return saveObj;
    }
}
