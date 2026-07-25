export interface FileEntry {
  path: string;
  name: string;
  status: "idle" | "converting" | "error";
  editor?: boolean;
  recordId?: string;
  error?: string;
}
