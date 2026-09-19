// The environment's own `BroadcastChannel`, which `test/setup.ts` supplies because jsdom has
// none and Node's stops delivering inside the jsdom realm on Node 22.12 (see the block there).
//
// Four tests of the presenter window rest on this class. When it silently delivers nothing they
// do not report a missing channel; they time out one by one, which is what CI showed for three
// runs while the same commit passed locally. This file states what the shim must do, so the next
// such breakage names itself.
import { describe, expect, it } from 'vitest';

/** Delivery is asynchronous by design; this waits a macrotask, as a listener would have to. */
const delivered = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('the BroadcastChannel the jsdom environment provides', () => {
  it('delivers to another channel of the same name', async () => {
    const rx = new BroadcastChannel('t1');
    const seen: unknown[] = [];
    rx.onmessage = (event) => seen.push(event.data);

    const tx = new BroadcastChannel('t1');
    tx.postMessage({ step: 2 });
    await delivered();

    expect(seen).toEqual([{ step: 2 }]);
    rx.close();
    tx.close();
  });

  it('does not deliver to the sender, nor to another name', async () => {
    const own: unknown[] = [];
    const other: unknown[] = [];
    const tx = new BroadcastChannel('t2');
    tx.onmessage = (event) => own.push(event.data);
    const elsewhere = new BroadcastChannel('t2-other');
    elsewhere.onmessage = (event) => other.push(event.data);

    tx.postMessage('x');
    await delivered();

    expect(own).toEqual([]);
    expect(other).toEqual([]);
    tx.close();
    elsewhere.close();
  });

  it('still delivers a message whose sender closed straight after posting', async () => {
    // Exactly what PresenterWindow.test.tsx's `post` helper does, and what the lecture shell's
    // effect cleanup does on every step change.
    const rx = new BroadcastChannel('t3');
    const seen: unknown[] = [];
    rx.onmessage = (event) => seen.push(event.data);

    const tx = new BroadcastChannel('t3');
    tx.postMessage('sent then closed');
    tx.close();
    await delivered();

    expect(seen).toEqual(['sent then closed']);
    rx.close();
  });

  it("delivers a clone, so a receiver cannot reach back into the sender's object", async () => {
    const rx = new BroadcastChannel('t4');
    const seen: Array<{ n: number }> = [];
    rx.onmessage = (event) => seen.push(event.data as { n: number });

    const tx = new BroadcastChannel('t4');
    const sent = { n: 1 };
    tx.postMessage(sent);
    sent.n = 99;
    await delivered();

    expect(seen).toEqual([{ n: 1 }]);
    rx.close();
    tx.close();
  });

  it('stops receiving once closed, and refuses to post', async () => {
    const rx = new BroadcastChannel('t5');
    const seen: unknown[] = [];
    rx.addEventListener('message', (event) => seen.push((event as MessageEvent).data));
    rx.close();

    const tx = new BroadcastChannel('t5');
    tx.postMessage('after close');
    await delivered();
    expect(seen).toEqual([]);

    tx.close();
    expect(() => tx.postMessage('too late')).toThrow();
  });
});
