// Convex functions read deployment env vars through `process.env`; the rest of Node's
// `process` does not exist in the default runtime, so only `env` is declared.
declare const process: { env: Record<string, string | undefined> };
