export function whenIdle(callback: () => void, timeout = 800): () => void {
  if (typeof window === "undefined") return () => {};

  if (typeof requestIdleCallback === "function") {
    const id = requestIdleCallback(() => callback(), { timeout });
    return () => cancelIdleCallback(id);
  }

  const timer = window.setTimeout(callback, Math.min(timeout, 200));
  return () => window.clearTimeout(timer);
}

export function observeOnce(
  element: Element,
  callback: () => void,
  rootMargin = "600px 0px",
): () => void {
  if (typeof IntersectionObserver === "undefined") {
    callback();
    return () => {};
  }

  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      callback();
    },
    { root: null, rootMargin, threshold: 0.01 },
  );

  observer.observe(element);
  return () => observer.disconnect();
}
