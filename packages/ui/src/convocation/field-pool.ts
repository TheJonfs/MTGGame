/**
 * S53: the field's workers — owned by the Convocation controller for the life of the page (the plan's Risk 1: never
 * the Lab's). A job is one series; a worker that dies takes its job back to the queue (a series is a pure function
 * of its seed, so a re-run is the same series). Each job carries the event with only its two seats filled.
 */
import type { ConvocationEvent, EntranceKnobs, SeriesState } from "@shandalar/world";
import type { FieldJob, FieldOut } from "./convocation-worker.js";

interface Slot { worker: Worker; ready: boolean; job: (FieldJob & { resolve: (s: SeriesState) => void; reject: (e: Error) => void }) | null }
type Pending = NonNullable<Slot["job"]>;

export class FieldPool {
  private slots: Slot[] = [];
  private queue: Pending[] = [];
  private nextId = 1;

  constructor(private readonly size: number, private readonly make: () => Worker) { for (let i = 0; i < size; i++) this.slots.push(this.spawn()); }

  private spawn(): Slot {
    const slot: Slot = { worker: this.make(), ready: false, job: null };
    slot.worker.onmessage = (ev: MessageEvent<FieldOut>) => {
      const m = ev.data;
      if (m.type === "ready") { slot.ready = true; return this.dispatch(); }
      const job = slot.job; slot.job = null;
      if (job && m.id === job.id) { if (m.type === "done") job.resolve(m.series); else job.reject(new Error(m.message)); }
      this.dispatch();
    };
    slot.worker.onerror = () => this.replace(slot);
    return slot;
  }
  private replace(slot: Slot): void {
    const job = slot.job;
    try { slot.worker.terminate(); } catch { /* gone */ }
    const i = this.slots.indexOf(slot), fresh = this.spawn();
    if (i >= 0) this.slots[i] = fresh;
    if (job) this.queue.unshift(job); // a series is a function of its seed: re-run it
  }
  private dispatch(): void {
    for (const slot of this.slots) {
      if (!slot.ready || slot.job || !this.queue.length) continue;
      const job = this.queue.shift()!; slot.job = job;
      const { resolve: _r, reject: _j, ...msg } = job;
      slot.worker.postMessage(msg);
    }
  }

  /** One series of `event` (a over b), played on a worker. */
  series(event: ConvocationEvent, a: number, b: number, knobs: EntranceKnobs): Promise<SeriesState> {
    const field = new Array(event.field.length); field[a] = event.field[a]; field[b] = event.field[b];
    const { results: _r, history: _h, draft: _d, ...rest } = event;
    return new Promise((resolve, reject) => { this.queue.push({ id: this.nextId++, event: { ...rest, field, results: [] } as ConvocationEvent, a, b, knobs, resolve, reject }); this.dispatch(); });
  }
  dispose(): void { for (const s of this.slots) { try { s.worker.terminate(); } catch { /* gone */ } } this.slots = []; this.queue = []; }
}

/** The page's pool: one worker a core, leaving one for the page; none outside a browser (the tests play on the main thread). */
export function makeFieldPool(): FieldPool | null {
  if (typeof Worker === "undefined" || typeof navigator === "undefined") return null;
  const n = Math.max(1, Math.min(8, (navigator.hardwareConcurrency || 4) - 1));
  return new FieldPool(n, () => new Worker(new URL("./convocation-worker.ts", import.meta.url), { type: "module" }));
}
