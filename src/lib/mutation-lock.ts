export class MutationLock {
  private locked = false;

  tryAcquire() {
    if (this.locked) return false;
    this.locked = true;
    return true;
  }

  release() {
    this.locked = false;
  }
}
