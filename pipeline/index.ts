export type Next<I, O> = (input: I) => O;

export type Action<I, O> = (index: number, input: I, next: Next<I, O>) => O;

export type Middleware<I = unknown, O = unknown> = (input: I, next: Next<I, O>) => O

export type Middlewares<I = unknown, O = unknown> = Middleware<I, O>[]

export type MiddlewareInput<I = unknown, O = unknown> = Middleware<I, O> | { middleware: Middleware<I, O> }

export type PipelineLike<I, O> = {
    readonly middlewares: Middlewares<I, O>;
    tap(...inputs: MiddlewareInput<I, O>[]): Pipeline<I, O>;
    call(input: I): O;
}

export function getMiddleware<I, O>(input: MiddlewareInput<I, O>): Middleware<I, O> {
    if (typeof input === 'function') {
        return input
    }
    if (input && typeof input.middleware === 'function') {
        return input.middleware;
    }
    throw new Error(`Invalid middleware: ${input} is not a Middleware function or { middleware: Middleware } object`);
}

export class Flow<I, O> {
    public constructor(private readonly action: Action<I, O>) { }

    public start(input: I): O {
        return this.dispatch(0, input);
    }

    private dispatch(index: number, input: I): O {
        return this.action(index, input, (i: I) => this.dispatch(index + 1, i));
    }
}

export class Pipeline<I = unknown, O = unknown> implements PipelineLike<I, O> {
    public readonly middlewares: Middlewares<I, O> = [];

    public constructor() { }

    public tap<T extends MiddlewareInput<I, O>>(...inputs: T[]): Pipeline<I, O> {
        this.middlewares.push(...inputs.map(getMiddleware));
        return this;
    }

    public call(input: I): O {
        return this.flow.start(input)
    }

    private readonly flow: Flow<I, O> = new Flow((index: number, input: I, next: Next<I, O>) => {
        if (index >= this.middlewares.length) {
            throw new Error("No middleware produced a result. Ensure the last middleware returns a value instead of calling next().");
        }

        return this.middlewares[index](input, next);
    });
}
