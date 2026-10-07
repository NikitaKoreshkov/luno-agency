/**
 * Единственная точка, которая гоняет ScrollTrigger по скроллу.
 *
 * Раньше каждая GSAP-сцена вешала свой `() => ScrollTrigger.update()` в seam
 * `__lunoScrollHooks`: при трёх смонтированных сценах это три полных прохода
 * ScrollTrigger за кадр, и каждый начинается с чтения layout сразу после того,
 * как Lenis записал scrollTop в этом же кадре. Замер на M2/1440: 8.8 принудительных
 * style+layout на кадр при скролле hero.
 */

type ScrollTriggerStatic = {
  update: () => void;
};

let scenes = 0;
let latest: ScrollTriggerStatic | null = null;
let tick: (() => void) | null = null;

/** Возвращает релиз — сцена вызывает его в cleanup. */
export function registerScrollTriggerScene(ScrollTrigger: ScrollTriggerStatic): () => void {
  latest = ScrollTrigger;
  scenes += 1;
  if (!tick) {
    tick = () => latest?.update();
    if (!window.__lunoScrollHooks) window.__lunoScrollHooks = new Set();
    window.__lunoScrollHooks.add(tick);
  }
  return () => {
    scenes -= 1;
    if (scenes <= 0 && tick) {
      window.__lunoScrollHooks?.delete(tick);
      tick = null;
      latest = null;
    }
  };
}
