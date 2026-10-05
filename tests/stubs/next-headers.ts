// Test double for next/headers: an in-memory cookie jar and header bag the tests can drive.
const jar = new Map<string, string>();
let hdrs = new Headers();

export function __reset() { jar.clear(); hdrs = new Headers(); }
export function __setCookie(name: string, value: string) { jar.set(name, value); }
export function __setHeader(name: string, value: string) { hdrs.set(name, value); }

export async function headers(): Promise<Headers> { return hdrs; }

export async function cookies() {
  return {
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => { jar.set(name, value); },
    delete: (name: string) => { jar.delete(name); },
    getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
    has: (name: string) => jar.has(name),
  };
}
