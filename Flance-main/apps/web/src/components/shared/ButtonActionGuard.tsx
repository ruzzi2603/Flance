"use client";

import { useEffect } from "react";

type ActionLock = {
  button: HTMLButtonElement | null;
  form: HTMLFormElement | null;
  startedAt: number;
  pendingRequests: number;
  lastRequestAt: number;
  finished: boolean;
  releaseTimer: ReturnType<typeof setTimeout> | null;
};

const ACTION_WINDOW_MS = 600;

/** Prevents repeated clicks/submits while the action's API requests are running. */
export function ButtonActionGuard() {
  useEffect(() => {
    const buttonLocks = new WeakMap<HTMLButtonElement, ActionLock>();
    const formLocks = new WeakMap<HTMLFormElement, ActionLock>();
    const activeLocks = new Set<ActionLock>();

    const beginRequestsForRecentActions = () => {
      const now = Date.now();
      const requestLocks = [...activeLocks].filter(
        (lock) => !lock.finished && now - lock.startedAt <= ACTION_WINDOW_MS,
      );
      for (const lock of requestLocks) {
        lock.pendingRequests += 1;
        lock.lastRequestAt = now;
        if (lock.releaseTimer) clearTimeout(lock.releaseTimer);
      }
      return requestLocks;
    };

    const finishRequestsForActions = (requestLocks: ActionLock[]) => {
      for (const lock of requestLocks) {
        lock.pendingRequests = Math.max(0, lock.pendingRequests - 1);
        lock.lastRequestAt = Date.now();
        scheduleUnlock(lock);
      }
    };

    const unlock = (lock: ActionLock) => {
      if (lock.finished) return;
      lock.finished = true;
      if (lock.releaseTimer) clearTimeout(lock.releaseTimer);
      if (lock.button) {
        lock.button.removeAttribute("data-action-pending");
        lock.button.removeAttribute("aria-busy");
        buttonLocks.delete(lock.button);
      }
      if (lock.form) formLocks.delete(lock.form);
      activeLocks.delete(lock);
    };

    const scheduleUnlock = (lock: ActionLock) => {
      if (lock.finished || lock.pendingRequests > 0) return;
      const minTimeRemaining = Math.max(0, 350 - (Date.now() - lock.startedAt));
      const quietTimeRemaining = lock.lastRequestAt
        ? Math.max(0, 180 - (Date.now() - lock.lastRequestAt))
        : 0;
      if (lock.releaseTimer) clearTimeout(lock.releaseTimer);
      lock.releaseTimer = setTimeout(() => unlock(lock), Math.max(minTimeRemaining, quietTimeRemaining));
    };

    const createLock = (button: HTMLButtonElement | null, form: HTMLFormElement | null) => {
      if (button?.disabled) return null;
      const lock: ActionLock = {
        button,
        form,
        startedAt: Date.now(),
        pendingRequests: 0,
        lastRequestAt: 0,
        finished: false,
        releaseTimer: null,
      };
      if (button) {
        buttonLocks.set(button, lock);
        button.setAttribute("data-action-pending", "true");
        button.setAttribute("aria-busy", "true");
      }
      if (form) formLocks.set(form, lock);
      activeLocks.add(lock);
      lock.releaseTimer = setTimeout(() => scheduleUnlock(lock), ACTION_WINDOW_MS);
      return lock;
    };

    const preventRepeat = (event: Event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest("button");
      if (!button || button.disabled) return;
      const form = button.form;
      const existingLock = buttonLocks.get(button) ?? (form ? formLocks.get(form) : undefined);
      if (existingLock) {
        preventRepeat(event);
        return;
      }
      // Submit buttons are locked on the submit event so their native form action can start.
      if (button.type !== "submit") createLock(button, null);
    };

    const onSubmit = (event: SubmitEvent) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      if (formLocks.has(form)) {
        preventRepeat(event);
        return;
      }
      const button = event.submitter instanceof HTMLButtonElement ? event.submitter : null;
      if (button && buttonLocks.has(button)) {
        preventRepeat(event);
        return;
      }
      createLock(button, form);
    };

    const originalFetch = window.fetch;
    const trackedFetch: typeof window.fetch = (...args) => {
      const requestLocks = beginRequestsForRecentActions();

      let request: ReturnType<typeof originalFetch>;
      try {
        request = originalFetch.apply(window, args);
      } catch (error) {
        finishRequestsForActions(requestLocks);
        throw error;
      }
      return request.finally(() => finishRequestsForActions(requestLocks));
    };

    const xhrPrototype = XMLHttpRequest.prototype;
    const originalXhrSend = xhrPrototype.send;
    const trackedXhrSend: typeof xhrPrototype.send = function (this: XMLHttpRequest, ...args) {
      const requestLocks = beginRequestsForRecentActions();
      if (requestLocks.length > 0) {
        this.addEventListener("loadend", () => finishRequestsForActions(requestLocks), { once: true });
      }
      try {
        return originalXhrSend.apply(this, args);
      } catch (error) {
        finishRequestsForActions(requestLocks);
        throw error;
      }
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    window.fetch = trackedFetch;
    xhrPrototype.send = trackedXhrSend;
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      if (window.fetch === trackedFetch) window.fetch = originalFetch;
      if (xhrPrototype.send === trackedXhrSend) xhrPrototype.send = originalXhrSend;
      for (const lock of activeLocks) unlock(lock);
    };
  }, []);

  return null;
}
