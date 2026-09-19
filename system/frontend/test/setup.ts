import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Testing Library only auto-cleans when Vitest globals are enabled. They are not, so renders
// would otherwise accumulate across tests and every query would find duplicates.
afterEach(() => {
  cleanup();
});

/**
 * jsdom 26 implements no `PointerEvent`.
 *
 * Testing Library's `fireEvent.pointerDown` falls back to a plain `Event` when the constructor
 * is missing, and a plain `Event` carries no `clientX`. React then hands the component
 * `undefined` coordinates. The failure is quiet in the worst way: a drag handler that reads
 * `event.clientX` sees `undefined`, computes a box of `NaN`, declines to emit it, and the test
 * that asserts "no box was drawn" passes — for a reason that has nothing to do with the rule it
 * claims to check.
 *
 * The polyfill is the smallest thing that makes the event real: `MouseEvent` already carries
 * the coordinates, and pointer identity is all that has to be added on top.
 */
if (typeof window.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent implements PointerEvent {
    readonly pointerId: number;
    readonly pointerType: string;
    readonly isPrimary: boolean;
    readonly width = 1;
    readonly height = 1;
    readonly pressure: number;
    readonly tangentialPressure = 0;
    readonly tiltX = 0;
    readonly tiltY = 0;
    readonly twist = 0;
    readonly altitudeAngle = 0;
    readonly azimuthAngle = 0;

    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
      this.pointerType = init.pointerType ?? 'mouse';
      this.isPrimary = init.isPrimary ?? true;
      this.pressure = init.pressure ?? (type === 'pointerup' ? 0 : 0.5);
    }

    getCoalescedEvents(): PointerEvent[] {
      return [this];
    }

    getPredictedEvents(): PointerEvent[] {
      return [];
    }
  }

  window.PointerEvent = PointerEventPolyfill as unknown as typeof PointerEvent;
  globalThis.PointerEvent = window.PointerEvent;
}

/**
 * jsdom's `AbortSignal` is not the one `Request` was compiled against.
 *
 * `react-router` in data-router mode builds a `Request` for every navigation so a loader can be
 * handed the abort signal. Under jsdom the signal comes from jsdom and the `Request` constructor
 * comes from Node's undici, which brand-checks it and throws `RequestInit: Expected signal
 * ("AbortSignal {}") to be an instance of AbortSignal`. The throw lands in a promise nobody
 * awaits, so the navigation simply never happens: the assertion that follows reads the old URL
 * and fails for a reason that has nothing to do with the routes under test.
 *
 * Retrying without the signal is the whole fix. Nothing in the suite aborts a navigation, and a
 * real browser never reaches this path because both classes come from the same realm there.
 */
{
  const NativeRequest = globalThis.Request;
  class RealmTolerantRequest extends NativeRequest {
    constructor(input: RequestInfo | URL, init?: RequestInit) {
      try {
        super(input, init);
      } catch (error) {
        if (!init?.signal || !(error instanceof TypeError)) throw error;
        const { signal: _signal, ...rest } = init;
        super(input, rest);
      }
    }
  }
  globalThis.Request = RealmTolerantRequest as unknown as typeof Request;
  window.Request = globalThis.Request;
}

/**
 * jsdom 26 implements no `BroadcastChannel`, and Node's is not a usable substitute here.
 *
 * The presenter window and the lecture shell talk over a `BroadcastChannel`, so four tests
 * depend on one instance hearing another. jsdom does not provide the class, and what the test
 * code has been using instead is Node's own global, reached from inside the jsdom realm.
 * **Whether that delivers anything depends on the Node version**: on Node 24.19 the message
 * arrives, on Node 22.12 it never does, and the four tests time out. Nothing in the suite says
 * which interpreter it needs, so the same commit passed on the author's machine (24.19) and
 * failed in CI (`node-version: '22.12'`) three runs in a row.
 *
 * Two probes located it. Two Node `BroadcastChannel`s exchange messages perfectly well on
 * 22.12 — on the main thread, inside a worker thread, and with the global `MessageEvent`
 * replaced. The delivery stops only inside the vm context that the jsdom environment runs test
 * code in. So this is not a defect in the application: a real browser implements the class
 * itself, and the product code is untouched by this block.
 *
 * The fix is to stop borrowing the host's implementation for an API the emulated environment is
 * missing. This is a same-realm `BroadcastChannel` over jsdom's own `EventTarget` and
 * `MessageEvent`, which behaves identically on every Node version. It is deliberately the
 * minimum the specification requires of the parts the suite uses: delivery to every *other*
 * open channel of the same name, asynchronously, with the data structured-cloned, and a closed
 * channel that neither sends nor receives.
 */
{
  const open = new Map<string, Set<TestBroadcastChannel>>();

  class TestBroadcastChannel extends EventTarget {
    readonly name: string;
    #closed = false;
    #onmessage: ((event: MessageEvent) => void) | null = null;

    constructor(name: string) {
      super();
      this.name = String(name);
      const peers = open.get(this.name) ?? new Set<TestBroadcastChannel>();
      peers.add(this);
      open.set(this.name, peers);
    }

    get onmessage(): ((event: MessageEvent) => void) | null {
      return this.#onmessage;
    }

    set onmessage(handler: ((event: MessageEvent) => void) | null) {
      if (this.#onmessage) this.removeEventListener('message', this.#onmessage as EventListener);
      this.#onmessage = handler;
      if (handler) this.addEventListener('message', handler as EventListener);
    }

    postMessage(data: unknown): void {
      if (this.#closed) throw new DOMException('Channel is closed', 'InvalidStateError');
      // Structured clone at post time, as the specification requires: a receiver that mutated
      // what it was handed would otherwise reach back into the sender's object.
      const payload = structuredClone(data);
      // A macrotask, not a microtask. The real class never delivers synchronously, and a test
      // that passed only because delivery was synchronous would be asserting the wrong thing.
      setTimeout(() => {
        for (const peer of open.get(this.name) ?? []) {
          if (peer === this || peer.#closed) continue;
          peer.dispatchEvent(new MessageEvent('message', { data: payload }));
        }
      }, 0);
    }

    close(): void {
      this.#closed = true;
      open.get(this.name)?.delete(this);
    }
  }

  globalThis.BroadcastChannel = TestBroadcastChannel as unknown as typeof BroadcastChannel;
  window.BroadcastChannel = globalThis.BroadcastChannel;
}
