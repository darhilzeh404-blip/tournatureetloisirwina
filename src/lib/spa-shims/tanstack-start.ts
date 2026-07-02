/**
 * SPA shim for @tanstack/react-start.
 * En build SPA pur, il n'y a pas de runtime serveur.
 * Les server functions sont remplacées par des appels Supabase directs côté client
 * lorsque c'est nécessaire ; sinon elles deviennent des no-ops sûrs.
 */

type Handler<TInput = unknown, TOutput = unknown> = (ctx: {
  data: TInput;
  context: Record<string, unknown>;
}) => Promise<TOutput> | TOutput;

interface ServerFnBuilder<TInput = unknown, TOutput = unknown> {
  middleware: (..._args: unknown[]) => ServerFnBuilder<TInput, TOutput>;
  inputValidator: (
    fn: (input: unknown) => TInput,
  ) => ServerFnBuilder<TInput, TOutput>;
  handler: (
    h: Handler<TInput, TOutput>,
  ) => ((input?: { data?: TInput }) => Promise<TOutput>) & { __spaShim: true };
}

export function createServerFn(_opts?: { method?: string }): ServerFnBuilder {
  let validator: ((input: unknown) => unknown) | null = null;
  const builder: ServerFnBuilder = {
    middleware() {
      return builder;
    },
    inputValidator(fn) {
      validator = fn as (i: unknown) => unknown;
      return builder;
    },
    handler(h) {
      const callable = async (input?: { data?: unknown }) => {
        const raw = input?.data;
        const data = validator ? validator(raw) : raw;
        return h({ data: data as never, context: {} });
      };
      (callable as unknown as { __spaShim: true }).__spaShim = true;
      return callable as unknown as ReturnType<ServerFnBuilder["handler"]>;
    },
  };
  return builder;
}

export function useServerFn<T extends (...args: any[]) => any>(fn: T): T {
  return fn;
}

export function createMiddleware() {
  const chain = {
    middleware: () => chain,
    server: () => chain,
    client: () => chain,
  };
  return chain;
}

export function getRequest(): Request | null {
  return null;
}
