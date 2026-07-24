export interface FileEntry {
  path: string;
  name: string;
  status: "idle" | "converting" | "done" | "error";
  outputPath?: string;
  error?: string;
}
