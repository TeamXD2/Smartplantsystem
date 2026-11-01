// Runs one action per item, one after another (so the backend's rate limits are
// respected), and carries on when one fails. Returns what worked and what didn't.
//   const { done, failed } = await runBulk(rows, (row) => api(...), (n, total) => ...)
export async function runBulk(items, action, onProgress) {
  const done = [];
  const failed = [];
  for (let i = 0; i < items.length; i += 1) {
    try {
      await action(items[i]);
      done.push(items[i]);
    } catch (err) {
      failed.push({ item: items[i], message: err.message });
    }
    if (onProgress) onProgress(i + 1, items.length);
  }
  return { done, failed };
}

export function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many || `${one}s`}`;
}
