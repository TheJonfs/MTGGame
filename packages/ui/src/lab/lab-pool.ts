/**
 * The Lab's worker pool (S33 director round, round three — Chris: grids ended with cells never run).
 * A module worker that fails to load (the dev server serving hundreds of modules to six workers at
 * once, a transient 500, a memory refusal) fires `error`, not `message` — and a job posted to it is
 * lost silently. The pool therefore: waits for each worker's READY handshake before it may take a
 * job; on a worker error it reports, replaces the worker and re-queues the job; a job with no
 * progress for `stallMs` is treated the same (a watchdog); and it publishes its status so the page
 * can show "6 workers: 4 ready, 1 loading, 1 failed" instead of a silent stop.
 */
import type { LabCell, LabJob, WorkerOut } from "./lab-types.js";

type Slot = { worker: Worker; ready: boolean; job: LabJob | null; lastBeat: number; failures: number };
export interface PoolStatus { workers: number; ready: number; busy: number; failed: number; queued: number }

export class LabWorkerPool {
  private slots: Slot[] = [];
  private queue: LabJob[] = [];
  private failedCount = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  onCell: (cell: LabCell, done: boolean) => void = () => {};
  onError: (message: string) => void = () => {};
  onStatus: (s: PoolStatus) => void = () => {};
  onIdle: () => void = () => {};

  constructor(private readonly size: number, private readonly make: () => Worker, private readonly stallMs = 90_000) {
    for (let i = 0; i < size; i++) this.slots.push(this.spawn());
    this.timer = setInterval(() => this.watchdog(), 5_000);
  }

  private spawn(): Slot {
    const slot: Slot = { worker: this.make(), ready: false, job: null, lastBeat: Date.now(), failures: 0 };
    slot.worker.onmessage = (ev: MessageEvent<WorkerOut | { type: "ready" }>) => {
      const m = ev.data;
      slot.lastBeat = Date.now();
      if (m.type === "ready") { slot.ready = true; this.dispatch(); return; }
      if (m.type === "error") { this.onError(m.message); return; }
      this.onCell(m.cell, m.type === "done");
      if (m.type === "done") { slot.job = null; this.dispatch(); }
    };
    slot.worker.onerror = (ev: ErrorEvent) => this.fail(slot, `worker error: ${ev.message || "failed to load"}`);
    slot.worker.onmessageerror = () => this.fail(slot, "worker message could not be decoded");
    return slot;
  }

  /** Replace a broken worker and put its job back at the FRONT of the queue. */
  private fail(slot: Slot, why: string): void {
    this.failedCount += 1;
    const job = slot.job;
    this.onError(`${why}${job ? ` — cell ${job.id} re-queued` : ""}`);
    try { slot.worker.terminate(); } catch { /* already gone */ }
    const i = this.slots.indexOf(slot);
    const fresh = this.spawn();
    fresh.failures = slot.failures + 1;
    if (i >= 0) this.slots[i] = fresh;
    if (job) {
      if (slot.failures >= 2) this.onError(`cell ${job.id} failed three times — dropped`);
      else this.queue.unshift(job);
    }
    this.publish();
    this.dispatch();
  }

  private watchdog(): void {
    const now = Date.now();
    for (const s of [...this.slots]) {
      if (s.job && now - s.lastBeat > this.stallMs) this.fail(s, `cell ${s.job.id}: no progress for ${Math.round(this.stallMs / 1000)}s`);
      else if (!s.ready && !s.job && now - s.lastBeat > this.stallMs) this.fail(s, "worker never became ready");
    }
  }

  private dispatch(): void {
    for (const s of this.slots) {
      if (!s.ready || s.job) continue;
      const next = this.queue.shift();
      if (!next) break;
      s.job = next; s.lastBeat = Date.now();
      s.worker.postMessage({ type: "run", job: next });
    }
    this.publish();
    if (this.queue.length === 0 && this.slots.every((s) => !s.job)) this.onIdle();
  }

  private publish(): void {
    this.onStatus({ workers: this.slots.length, ready: this.slots.filter((s) => s.ready).length, busy: this.slots.filter((s) => !!s.job).length, failed: this.failedCount, queued: this.queue.length });
  }

  run(jobs: LabJob[]): void { this.queue.push(...jobs); this.dispatch(); }
  /** Drop the queue and abandon running jobs (fresh workers replace the busy ones). */
  stop(): void {
    this.queue = [];
    for (const s of [...this.slots]) if (s.job) { try { s.worker.terminate(); } catch { /* gone */ } this.slots[this.slots.indexOf(s)] = this.spawn(); }
    this.publish();
  }
  get idle(): boolean { return this.queue.length === 0 && this.slots.every((s) => !s.job); }
  dispose(): void { if (this.timer) clearInterval(this.timer); for (const s of this.slots) s.worker.terminate(); this.slots = []; }
}
