import type { ReminderScheduler } from '../ports/reminder-scheduler';
import type { ReminderPlan } from './reminder-plan';

export type ReminderStatus =
  'off' | 'waiting' | 'scheduled' | 'skipped' | 'past' | 'permission' | 'error';
export interface ReminderSnapshot {
  readonly status: ReminderStatus;
  readonly at?: number;
}

/** Serializes OS writes. Only a changed plan or a missing future registration is rescheduled. */
export class ReminderRuntime {
  private adapter: ReminderScheduler | undefined;
  private snapshot: ReminderSnapshot = { status: 'off' };
  private readonly listeners = new Set<() => void>();
  private queue = Promise.resolve();
  get available(): boolean {
    return this.adapter !== undefined;
  }
  readonly getSnapshot = () => this.snapshot;
  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  install(adapter: ReminderScheduler): void {
    this.adapter = adapter;
  }
  private publish(snapshot: ReminderSnapshot): void {
    this.snapshot = snapshot;
    this.listeners.forEach((listener) => {
      listener();
    });
  }
  private run(action: (adapter: ReminderScheduler) => Promise<void>): Promise<void> {
    const adapter = this.adapter;
    if (!adapter) return Promise.resolve();
    const task = this.queue.then(() => action(adapter));
    this.queue = task.catch(() => {
      this.publish({ status: 'error' });
    });
    return task;
  }
  enable(): Promise<void> {
    return this.run(async (adapter) => {
      if (!(await adapter.permission(true))) {
        this.publish({ status: 'permission' });
        return;
      }
      const receipt = await adapter.read();
      await adapter.write({ ...receipt, armed: true });
      this.publish({ status: 'waiting' });
    });
  }
  disable(): Promise<void> {
    return this.run(async (adapter) => {
      // Disarm first so interrupted cleanup cannot restore a cancelled reminder.
      await adapter.write({ armed: false });
      await adapter.clear();
      this.publish({ status: 'off' });
    });
  }
  skip(plan: ReminderPlan): Promise<void> {
    return this.run(async (adapter) => {
      const receipt = await adapter.read();
      await adapter.write({ ...receipt, skippedCycle: plan.cycleKey });
      await adapter.clear();
      this.publish({ status: 'skipped' });
    });
  }
  reconcile(plan: ReminderPlan | undefined): Promise<void> {
    return this.run(async (adapter) => {
      const receipt = await adapter.read();
      if (!receipt.armed) {
        await adapter.clear();
        this.publish({ status: 'off' });
        return;
      }
      const now = Date.now();
      if (receipt.scheduledAt !== undefined && receipt.scheduledAt <= now) {
        if (receipt.scheduledCycle !== undefined) receipt.handledCycle = receipt.scheduledCycle;
        delete receipt.scheduledAt;
        delete receipt.scheduledCycle;
        delete receipt.fingerprint;
        await adapter.write(receipt);
      }
      if (!plan) {
        await adapter.clear();
        this.publish({ status: 'waiting' });
        return;
      }
      if (receipt.skippedCycle === plan.cycleKey || receipt.handledCycle === plan.cycleKey) {
        // Never resurrect skipped, delivered, or potentially already-delivered occurrences.
        const status = receipt.skippedCycle === plan.cycleKey ? 'skipped' : 'past';
        if (status === 'skipped') await adapter.clear();
        this.publish({ status });
        return;
      }
      if (plan.at <= now) {
        await adapter.clear();
        this.publish({ status: 'past' });
        return;
      }
      if (!(await adapter.permission(false))) {
        await adapter.clear();
        this.publish({ status: 'permission' });
        return;
      }
      const fingerprint = JSON.stringify(plan);
      if (receipt.fingerprint !== fingerprint || !(await adapter.pending())) {
        await adapter.clear();
        await adapter.schedule(plan);
        await adapter.write({
          ...receipt,
          fingerprint,
          scheduledAt: plan.at,
          scheduledCycle: plan.cycleKey,
        });
      }
      this.publish({ status: 'scheduled', at: plan.at });
    });
  }
}

export const reminderRuntime = new ReminderRuntime();
