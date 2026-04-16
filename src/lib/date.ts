export const REFERENCE_DATE: Date = new Date("2026-04-16T00:00:00.000Z");

export function daysBetween(earlier: Date | string, later: Date | string): number {
  const start = typeof earlier === "string" ? new Date(earlier) : earlier;
  const end = typeof later === "string" ? new Date(later) : later;
  const ms = end.getTime() - start.getTime();
  if (ms <= 0) return 0;
  return Math.floor(ms / 86_400_000);
}
