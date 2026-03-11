import { describe, it, expect } from "vitest";
import { Semaphore } from "./semaphore.js";

describe("Semaphore", () => {
  it("allows up to max concurrent acquisitions", async () => {
    const sem = new Semaphore(2);
    await sem.acquire();
    await sem.acquire();
    expect(sem.active).toBe(2);
    expect(sem.pending).toBe(0);
  });

  it("queues beyond max", async () => {
    const sem = new Semaphore(1);
    await sem.acquire();

    let resolved = false;
    const pending = sem.acquire().then(() => {
      resolved = true;
    });

    // Give microtask a chance to run
    await new Promise((r) => setTimeout(r, 10));
    expect(resolved).toBe(false);
    expect(sem.pending).toBe(1);

    sem.release();
    await pending;
    expect(resolved).toBe(true);
    expect(sem.active).toBe(1);
    expect(sem.pending).toBe(0);
  });

  it("releases correctly and allows next in queue", async () => {
    const sem = new Semaphore(1);
    const order: number[] = [];

    await sem.acquire();
    order.push(1);

    const p2 = sem.acquire().then(() => {
      order.push(2);
      sem.release();
    });

    const p3 = sem.acquire().then(() => {
      order.push(3);
      sem.release();
    });

    sem.release();
    await Promise.all([p2, p3]);

    expect(order).toEqual([1, 2, 3]);
  });

  it("tracks active and pending counts", async () => {
    const sem = new Semaphore(2);
    expect(sem.active).toBe(0);
    expect(sem.pending).toBe(0);

    await sem.acquire();
    expect(sem.active).toBe(1);

    await sem.acquire();
    expect(sem.active).toBe(2);

    sem.release();
    expect(sem.active).toBe(1);

    sem.release();
    expect(sem.active).toBe(0);
  });
});
