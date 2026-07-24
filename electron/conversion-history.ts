import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";

import type { ConversionRecord } from "./types";

const HISTORY_DIR = join(homedir(), ".md2docx");
const HISTORY_FILE = join(HISTORY_DIR, "conversion-history.json");
const MAX_RECORDS = 30;

export function loadHistory(): ConversionRecord[] {
  if (!existsSync(HISTORY_FILE)) return [];
  try {
    const raw: unknown = JSON.parse(readFileSync(HISTORY_FILE, "utf-8"));
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(isConversionRecord)
      .sort((a, b) => (b.completedAt ?? b.startedAt) - (a.completedAt ?? a.startedAt));
  } catch {
    return [];
  }
}

export function saveHistory(records: ConversionRecord[]): void {
  const sliced = selectHistoryToPersist(records);
  mkdirSync(dirname(HISTORY_FILE), { recursive: true });
  const tmp = `${HISTORY_FILE}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(tmp, JSON.stringify(sliced, null, 2), "utf-8");
  renameSync(tmp, HISTORY_FILE);
}

export function selectHistoryToPersist(records: ConversionRecord[]): ConversionRecord[] {
  const sorted = [...records].sort(
    (a, b) => (b.completedAt ?? b.startedAt) - (a.completedAt ?? a.startedAt),
  );
  const active = sorted.filter(({ status }) => status === "converting");
  const completed = sorted
    .filter(({ status }) => status !== "converting")
    .slice(0, Math.max(0, MAX_RECORDS - active.length));
  return [...active, ...completed];
}

export function createRecord(id: string, sourcePath: string, preset: string): ConversionRecord {
  return {
    id,
    sourcePath,
    sourceName: basename(sourcePath),
    preset,
    status: "converting",
    startedAt: Date.now(),
  };
}

export function recoverHistory(): ConversionRecord[] {
  const records = loadHistory();
  let changed = false;

  for (const record of records) {
    if (record.status === "converting") {
      record.status = "error";
      record.error = "上次转换已中断";
      record.completedAt = Date.now();
      changed = true;
    }
    if (record.status === "success" && !existsSync(record.sourcePath)) {
      record.status = "missing";
      changed = true;
    } else if (record.status === "missing" && existsSync(record.sourcePath)) {
      record.status = "success";
      changed = true;
    }
  }

  if (changed) saveHistory(records);
  return records;
}

export function removeHistoryRecord(recordId: string): void {
  const records = loadHistory();
  const record = records.find(({ id }) => id === recordId);
  if (!record) return;
  if (record.status === "converting") throw new Error("转换中的记录不能删除");
  saveHistory(records.filter(({ id }) => id !== recordId));
}

export function clearCompletedHistory(): void {
  saveHistory(loadHistory().filter(({ status }) => status === "converting"));
}

function isConversionRecord(value: unknown): value is ConversionRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.sourcePath === "string" &&
    typeof record.sourceName === "string" &&
    typeof record.preset === "string" &&
    ["converting", "success", "error", "missing"].includes(String(record.status)) &&
    typeof record.startedAt === "number" &&
    (record.outputPath === undefined || typeof record.outputPath === "string") &&
    (record.completedAt === undefined || typeof record.completedAt === "number") &&
    (record.error === undefined || typeof record.error === "string")
  );
}
