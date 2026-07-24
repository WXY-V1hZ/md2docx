export interface FileEntry {
  path: string;
  name: string;
  status: "idle" | "converting" | "error";
  recordId?: string;
  error?: string;
}
