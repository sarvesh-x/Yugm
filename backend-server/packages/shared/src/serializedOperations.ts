/**
 * Serialises async read-modify-write units so they cannot interleave.
 *
 * This is an in-flight lock only: it stores no state that needs to survive a
 * Durable Object hibernation, which occurs only when no work is in flight. A
 * rejected unit does not poison the queue.
 */
export class SerializedOperations {
  private tail: Promise<void> = Promise.resolve();

  run<T>(work: () => Promise<T>): Promise<T> {
    const result = this.tail.then(work);
    this.tail = result.then(() => undefined, () => undefined);
    return result;
  }
}
