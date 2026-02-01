/**
 * Create a fixed-size buffer that keeps the newest entries.
 */
export function createTailBuffer(limit: number): {
  push: (value: string) => void;
  values: () => string[];
} {
  const items: string[] = [];
  return {
    push: (value) => {
      items.push(value);
      if (items.length > limit) {
        items.shift();
      }
    },
    values: () => [...items]
  };
}
