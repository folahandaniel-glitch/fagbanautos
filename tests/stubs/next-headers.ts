// Test stub: outside a Next.js request there is no headers() scope.
export async function headers(): Promise<Headers> {
  throw new Error("no request scope");
}
export async function cookies(): Promise<never> {
  throw new Error("no request scope");
}
