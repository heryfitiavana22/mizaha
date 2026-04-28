export function flattenSnapshot(obj: Record<string, unknown>): string[] {
  const lines: string[] = [];
  function walk(o: Record<string, unknown>) {
    for (const [key, value] of Object.entries(o)) {
      if (value === null || value === undefined || value === "") continue;
      if (Array.isArray(value)) {
        if (value.length > 0) lines.push(`${key}: ${value.join(", ")}`);
      } else if (typeof value === "object") {
        walk(value as Record<string, unknown>);
      } else {
        lines.push(`${key}: ${String(value)}`);
      }
    }
  }
  walk(obj);
  return lines;
}
