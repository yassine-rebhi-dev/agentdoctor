/** A file in the repository tree. `size` is in bytes. */
export interface FileEntry {
  path: string;
  size: number;
}

/** Read-only view of a repository: the local filesystem (CLI) or the GitHub API (web). */
export interface RepoSource {
  /** Human-readable name, e.g. "owner/repo" or a local path. */
  readonly name: string;
  list(): Promise<FileEntry[]>;
  /** File contents as text, or null if missing / too large / binary. */
  read(path: string): Promise<string | null>;
}

export type Status = "pass" | "partial" | "fail";

export interface CheckResult {
  id: string;
  title: string;
  status: Status;
  points: number;
  maxPoints: number;
  /** Concrete things found (file paths, commands) so the score is never a black box. */
  evidence: string[];
  /** What to do, only present when not passing. */
  fix?: string;
  /** Where the recommendation comes from. */
  source: string;
}

/** Everything a check may look at, loaded once. */
export interface Context {
  files: FileEntry[];
  paths: Set<string>;
  read(path: string): Promise<string | null>;
}

export interface Check {
  id: string;
  title: string;
  maxPoints: number;
  source: string;
  run(ctx: Context): Promise<Omit<CheckResult, "id" | "title" | "maxPoints" | "source">>;
}

export interface Report {
  repo: string;
  /** "content" = mostly Markdown and no code manifest (lists, skills, tutorials); code checks matter less there. */
  kind: "code" | "content";
  score: number;
  grade: string;
  results: CheckResult[];
}
