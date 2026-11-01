import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

/** `React.lazy` for a named export, so screens can keep named exports and still be code-split. */
export function lazyNamed<P extends object, K extends string>(
  load: () => Promise<Record<K, ComponentType<P>>>,
  name: K,
): LazyExoticComponent<ComponentType<P>> {
  return lazy(async () => ({ default: (await load())[name] }));
}
