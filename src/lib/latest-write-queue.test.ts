import { describe, expect, it, vi } from "vitest";
import { LatestWriteQueue } from "./latest-write-queue";

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
};

describe("LatestWriteQueue", () => {
  it("serializes a resource and coalesces waiting values", async () => {
    const first = deferred();
    const writes: number[] = [];
    const write = vi.fn(async (value: number) => {
      writes.push(value);
      if (value === 1) await first.promise;
    });
    const queue = new LatestWriteQueue(write, { onError: vi.fn(), onChange: vi.fn() });

    queue.enqueue("card", 1);
    queue.enqueue("card", 2);
    queue.enqueue("card", 3);
    expect(writes).toEqual([1]);

    first.resolve();
    await vi.waitFor(() => expect(queue.isPending()).toBe(false));
    expect(writes).toEqual([1, 3]);
  });

  it("continues to the newest value after a failed write", async () => {
    const first = deferred();
    const errors: unknown[] = [];
    const write = vi.fn(async (value: number) => {
      if (value === 1) { await first.promise; throw new Error("failed"); }
    });
    const queue = new LatestWriteQueue(write, { onError: (error) => errors.push(error), onChange: vi.fn() });

    queue.enqueue("card", 1);
    queue.enqueue("card", 2);
    first.resolve();

    await vi.waitFor(() => expect(queue.isPending()).toBe(false));
    expect(write).toHaveBeenCalledTimes(2);
    expect(errors).toHaveLength(1);
  });
});
