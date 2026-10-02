import { describe, expect, it } from "vitest";
import { MutationLock } from "./mutation-lock";

describe("MutationLock", () => {
  it("rejects duplicate work until the active mutation finishes", () => {
    const lock = new MutationLock();

    expect(lock.tryAcquire()).toBe(true);
    expect(lock.tryAcquire()).toBe(false);

    lock.release();
    expect(lock.tryAcquire()).toBe(true);
  });
});
