export type LogEvent = {
  event: string;
  tool?: string;
  duration_ms?: number;
  success: boolean;
  error_category?: string;
};

export function log(entry: LogEvent): void {
  process.stdout.write(`${JSON.stringify(entry)}\n`);
}
