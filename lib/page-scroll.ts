export function scrollPageToId(hash: string, behavior: ScrollBehavior = "smooth") {
  const id = hash.replace(/^#/, "");
  if (!id) return;
  const el = document.getElementById(id);
  if (!el) return;

  if ((window as any).lenisSmoothScrollTo) {
    (window as any).lenisSmoothScrollTo(`#${id}`);
    return;
  }

  el.scrollIntoView({ behavior, block: "start" });
}
