type QueueCallbacks<T> = {
  onError: (error: unknown, value: T) => void;
  onChange: () => void;
};

type Entry<T> = { running: boolean; pending?: T };

/** Serializes writes per key and keeps only the newest value waiting behind a write. */
export class LatestWriteQueue<T> {
  private readonly entries = new Map<string, Entry<T>>();

  constructor(
    private readonly write: (value: T) => Promise<void>,
    private readonly callbacks: QueueCallbacks<T>,
  ) {}

  enqueue(key: string, value: T) {
    const entry = this.entries.get(key) ?? { running: false };
    entry.pending = value;
    this.entries.set(key, entry);
    this.callbacks.onChange();
    if (!entry.running) void this.drain(key, entry);
  }

  isPending() {
    return this.entries.size > 0;
  }

  private async drain(key: string, entry: Entry<T>) {
    entry.running = true;
    while (entry.pending !== undefined) {
      const value = entry.pending;
      entry.pending = undefined;
      try {
        await this.write(value);
      } catch (error) {
        this.callbacks.onError(error, value);
      }
    }
    this.entries.delete(key);
    this.callbacks.onChange();
  }
}
