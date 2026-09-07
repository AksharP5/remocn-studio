const stubbed = new Map<string, PropertyDescriptor | undefined>();

export function stubGlobal(name: string, value: unknown): void {
  if (!stubbed.has(name)) {
    stubbed.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  }
  Object.defineProperty(globalThis, name, {
    configurable: true,
    value,
    writable: true,
  });
}

export function unstubAllGlobals(): void {
  for (const [name, descriptor] of stubbed) {
    if (descriptor) {
      Object.defineProperty(globalThis, name, descriptor);
    } else {
      delete (globalThis as Record<string, unknown>)[name];
    }
  }
  stubbed.clear();
}
