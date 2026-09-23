import type { ReminderPlan } from '../reminders/reminder-plan';

export interface ReminderReceipt {
  armed: boolean;
  skippedCycle?: string;
  skippedAt?: number;
  skippedFingerprint?: string;
  handledCycle?: string;
  scheduledCycle?: string;
  scheduledAt?: number;
  fingerprint?: string;
}

export interface ReminderScheduler {
  permission(request: boolean): Promise<boolean>;
  pending(): Promise<boolean>;
  schedule(plan: ReminderPlan): Promise<void>;
  clear(): Promise<void>;
  read(): Promise<ReminderReceipt>;
  write(receipt: ReminderReceipt): Promise<void>;
}
