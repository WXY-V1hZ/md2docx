export interface ConversionRecord {
  id: string;
  sourcePath: string;
  outputPath?: string;
  sourceName: string;
  preset: string;
  status: "converting" | "success" | "error" | "missing";
  startedAt: number;
  completedAt?: number;
  error?: string;
}

export interface DesktopConversionFile {
  id: string;
  path: string;
  editor?: boolean;
  outputPath?: string;
}

export interface DesktopConversionRequest {
  files: DesktopConversionFile[];
  preset: string;
  config: AppConfig;
  styleConfig: StyleConfig;
  openAfterConvert: boolean;
  legacyJobId?: string;
}

export type DesktopConversionResult =
  | {
      status: "done";
      path: string;
      outputPath: string;
      recordId: string;
      jobId?: string;
    }
  | {
      status: "error";
      path: string;
      error: string;
      recordId: string;
      jobId?: string;
      missing?: boolean;
    };
import type { AppConfig } from "../src/config";
import type { StyleConfig } from "../src/style/config";
