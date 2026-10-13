(function (root) {
  class GoalClock {
    constructor() { this.clear(); }
    clear() { this.remaining = null; this.deadline = null; this.done = false; }
    start(minutes, running, now = Date.now()) {
      if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180) throw new Error('Invalid duration');
      this.remaining = minutes * 60000; this.done = false;
      this.deadline = running ? now + this.remaining : null;
    }
    tick(now = Date.now()) {
      if (this.deadline !== null) this.remaining = Math.max(0, this.deadline - now);
      return this.remaining;
    }
    pause(now = Date.now()) { this.tick(now); this.deadline = null; }
    resume(now = Date.now()) { if (!this.done && this.remaining > 0 && this.deadline === null) this.deadline = now + this.remaining; }
    complete() { this.remaining = 0; this.deadline = null; this.done = true; }
  }
  if (typeof module !== 'undefined') module.exports = GoalClock;
  else root.GoalClock = GoalClock;
})(globalThis);
