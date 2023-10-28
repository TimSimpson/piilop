export type TestContextFunc<C extends ITestContext, R, T extends any[]> = (
    ctx: C,
    ...args: T
) => Promise<R>;

export interface TestContextPushArgs {
    name: string;
}

export interface ITestContext {
    /** Called when the test context is entered */
    begin(args: TestContextPushArgs): this;
    /** the string name of a context, or null if no name is expected */
    currentTestName(): string | null;
    /**
     * pass a function that should be called when the context ends. If
     * caller is 1, the function should be called when the parent context ends,
     * if it's 2, when the parent's parent ends, etc.
     */
    defer(caller: number, f: Function): void;
    /** called when a context has ended */
    end(): this;
}

export interface WrapArgs<T extends any[]> {
    name?: string;
    nameFunc?: (...args: T) => string;
}

const wasWrapped = Symbol("testContextWrapped");

type WrappedFunction<
    C extends ITestContext,
    R,
    T extends any[],
> = TestContextFunc<C, R, T> & {
    [wasWrapped]: true;
};

export const isWrapped = <C extends ITestContext, R, T extends any[]>(
    fn: TestContextFunc<C, R, T>,
): fn is WrappedFunction<C, R, T> => wasWrapped in fn;

/**
 * Takes any function that accepts an ITestContext like thing as the first
 * argument and wraps it, so that it will call .begin and .end on the
 * test context even if an exception is thrown.
 */
export const wrap = <C extends ITestContext, R, T extends any[]>(
    fn: TestContextFunc<C, R, T>,
    wrapArgs?: WrapArgs<T>,
): WrappedFunction<C, R, T> => {
    if (isWrapped<C, R, T>(fn)) return fn;

    const wrappedFn: TestContextFunc<C, R, T> = async (
        ctx: C,
        ...args: T
    ): Promise<R> => {
        let name: string;
        if (wrapArgs?.nameFunc) {
            name = wrapArgs.nameFunc(...args);
        } else if (wrapArgs?.name) {
            name = wrapArgs.name;
        } else {
            name = fn.name;
        }
        if (!name) {
            throw new Error("name missing for wrapped function!");
        }
        const ctx2 = ctx.begin({ name });
        try {
            return await fn(ctx2, ...args);
        } finally {
            ctx2.end();
        }
    };

    (wrappedFn as any)[wasWrapped] = true;

    return wrappedFn as WrappedFunction<C, R, T>;
};
