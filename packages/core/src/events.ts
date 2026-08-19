/**
 * Minimal synchronous typed event bus. The engine defines its own EventMap
 * (engine-design §4); core stays rules-free.
 */
export class EventBus<M extends Record<string, unknown>> {
  private listeners = new Map<keyof M, Set<(payload: never) => void>>();

  on<K extends keyof M>(name: K, fn: (payload: M[K]) => void): () => void {
    let set = this.listeners.get(name);
    if (!set) {
      set = new Set();
      this.listeners.set(name, set);
    }
    set.add(fn as (payload: never) => void);
    return () => set.delete(fn as (payload: never) => void);
  }

  emit<K extends keyof M>(name: K, payload: M[K]): void {
    const set = this.listeners.get(name);
    if (!set) return;
    for (const fn of [...set]) (fn as (payload: M[K]) => void)(payload);
  }
}
