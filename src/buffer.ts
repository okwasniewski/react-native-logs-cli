/**
 * Create a fixed-size buffer that keeps the newest entries.
 */
export function createTailBuffer<T>(limit: number): {
  push: (value: T) => void;
  values: () => T[];
} {
  const items: T[] = [];
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
