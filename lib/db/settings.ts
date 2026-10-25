import { getDb, type SettingRecord } from "./index";

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const record = await getDb().settings.get(key);
  return record ? (record.value as T) : fallback;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const record: SettingRecord = { key, value };
  await getDb().settings.put(record);
}

export async function deleteSetting(key: string): Promise<void> {
  await getDb().settings.delete(key);
}
