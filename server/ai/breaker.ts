/** Skips a provider for a while after a quota, overload or timeout error, to protect free quotas. */
export class CircuitBreaker {
  private readonly openUntil = new Map<string, number>();

  constructor(
    private readonly cooldownMs = 60_000,
    private readonly now: () => number = Date.now,
  ) {}

  isOpen(id: string): boolean {
    const until = this.openUntil.get(id);
    if (until === undefined) return false;
    if (until <= this.now()) {
      this.openUntil.delete(id);
      return false;
    }
    return true;
  }

  trip(id: string): void {
    this.openUntil.set(id, this.now() + this.cooldownMs);
  }

  reset(id: string): void {
    this.openUntil.delete(id);
  }
}
