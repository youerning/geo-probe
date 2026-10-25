"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { getSetting, setSetting } from "@/lib/db/settings";
import { DEFAULT_SETTINGS } from "@/lib/config";
import type { AppSettings } from "@/lib/types";

const SETTINGS_KEY = "app-settings";

export function useAppSettings() {
  const settings = useLiveQuery(async () => {
    const stored = await getSetting<Partial<AppSettings>>(SETTINGS_KEY, {});
    return { ...DEFAULT_SETTINGS, ...stored };
  }, []);

  const save = async (patch: Partial<AppSettings>) => {
    const stored = await getSetting<Partial<AppSettings>>(SETTINGS_KEY, {});
    await setSetting(SETTINGS_KEY, { ...DEFAULT_SETTINGS, ...stored, ...patch });
  };

  return {
    settings: settings ?? DEFAULT_SETTINGS,
    loading: settings === undefined,
    save,
  };
}
