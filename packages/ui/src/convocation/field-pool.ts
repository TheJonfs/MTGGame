/**
 * S53: the field's workers — owned by the Convocation controller for the life of the page (the plan's Risk 1: never
 * the Lab's). A job is one series; a worker that dies takes its job back to the queue (a series is a pure function
 * of its seed, so a re-run is the same series). Each job carries the event with only its two seats filled.
 *
 * Post-S53 (Chris: the field hung at "0 of 63" after a redeploy): a worker that cannot START — a page loaded before a
 * deploy asks for the old build's worker file, which is gone — failed, respawned and failed forever, and a job that
 * errored left the round's promise rejected with nothing catching it. Now the pool BREAKS instead: when workers fail
 * before ever being ready (as many times as there are slots), or none is ready within READY_MS, every waiting job is
 * rejected and later ones are refused — the controller then plays the field on the main thread (the same series).
 */
import type { ConvocationEvent, EntranceKnobs, SeriesState } from "@shandalar/world";
import type { FieldJob, FieldOut } from "./convocation-worker.js";

interface Slot { worker: Worker; ready: boolean; job: (FieldJob & { resolve: (s: SeriesState) => void; reject: (e: Error) => void }) | null }
type Pending = NonNullable<Slot["job"]>;

export const READY_MS = 20_000;
export class FieldPool {
  private slots: Slot[] = [];
  private queue: Pending[] = [];
  private nextId = 1;
  private startFailures = 0;
  private everReady = false;
  private readyTimer: ReturnType<typeof setTimeout> | null = null;
  /** Set when the workers cannot be relied on; every job is then refused (the caller plays on the main thread). */
  broken: string | null = null;

  constructor(private readonly size: number, private readonly make: () => Worker, readyMs = READY_MS) {
    for (let i = 0; i < size; i++) this.slots.push(this.spawn());
    this.readyTimer = setTimeout(() => { if (!this.everReady) this.breakAll(`no field worker started within ${Math.round(readyMs / 1000)} s`); }, readyMs);
  }

  private spawn(): Slot {
    const slot: Slot = { worker: this.make(), ready: false, job: null };
    slot.worker.onmessage = (ev: MessageEvent<FieldOut>) => {
      const m = ev.data;
      if (m.type === "ready") { slot.ready = true; this.everReady = true; if (this.readyTimer) { clearTimeout(this.readyTimer); this.readyTimer = null; } return this.dispatch(); }
      const job = slot.job; slot.job = null;
      if (job && m.id === job.id) { if (m.type === "done") job.resolve(m.series); else job.reject(new Error(m.message)); }
      this.dispatch();
    };
    slot.worker.onerror = () => this.replace(slot);
    return slot;
  }
  private replace(slot: Slot): void {
    if (this.broken) return;
    if (!slot.ready && (this.startFailures += 1) >= this.size) return this.breakAll("the field workers could not start (a page from before a deploy? reload)");
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

  /** Give up on the workers: reject what waits and what runs; refuse what comes. */
  breakAll(why: string): void {
    if (this.broken) return;
    this.broken = why;
    if (this.readyTimer) { clearTimeout(this.readyTimer); this.readyTimer = null; }
    const pending = [...this.queue, ...this.slots.flatMap((s) => (s.job ? [s.job] : []))];
    this.queue = [];
    for (const s of this.slots) { s.job = null; try { s.worker.terminate(); } catch { /* gone */ } }
    for (const j of pending) j.reject(new Error(why));
  }

  /** One series of `event` (a over b), played on a worker. */
  series(event: ConvocationEvent, a: number, b: number, knobs: EntranceKnobs): Promise<SeriesState> {
    if (this.broken) return Promise.reject(new Error(this.broken));
    const field = new Array(event.field.length); field[a] = event.field[a]; field[b] = event.field[b];
    const { results: _r, history: _h, draft: _d, ...rest } = event;
    return new Promise((resolve, reject) => { this.queue.push({ id: this.nextId++, event: { ...rest, field, results: [] } as ConvocationEvent, a, b, knobs, resolve, reject }); this.dispatch(); });
  }
  dispose(): void { if (this.readyTimer) clearTimeout(this.readyTimer); for (const s of this.slots) { try { s.worker.terminate(); } catch { /* gone */ } } this.slots = []; this.queue = []; }
}

/** The page's pool: one worker a core, leaving one for the page; none outside a browser (the tests play on the main thread). */
export function makeFieldPool(): FieldPool | null {
  if (typeof Worker === "undefined" || typeof navigator === "undefined") return null;
  const n = Math.max(1, Math.min(8, (navigator.hardwareConcurrency || 4) - 1));
  return new FieldPool(n, () => new Worker(new URL("./convocation-worker.ts", import.meta.url), { type: "module" }));
}
