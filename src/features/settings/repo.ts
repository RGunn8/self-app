// All writes for this feature go through here.
import { eq } from 'drizzle-orm';

import { settings, type Settings } from '@/features/settings/model';
import { db } from '@/shared/db/client';

export const DEFAULT_SETTINGS: Settings = {
  id: 'me',
  onboardedAt: null,
  userName: null,
  distanceUnit: 'mi',
  checkinEnabled: false,
  checkinDay: 0,
  checkinTime: '18:00',
  scoreDisplay: 'badge',
  appearance: 'system',
  planReminders: false,
  planningEnabled: true,
  dayPlanLimit: 6,
  dayScoreEnabled: false,
  startTab: 'identities',
  updatedAt: 0,
};

export const settingsRepo = {
  get(): Settings {
    const row = db.select().from(settings).where(eq(settings.id, 'me')).get();
    if (row) return row;
    const fresh = { ...DEFAULT_SETTINGS, updatedAt: Date.now() };
    db.insert(settings).values(fresh).run();
    return fresh;
  },
  update(patch: Partial<Omit<Settings, 'id'>>) {
    this.get();
    db.update(settings)
      .set({ ...patch, updatedAt: Date.now() })
      .where(eq(settings.id, 'me'))
      .run();
  },
};
