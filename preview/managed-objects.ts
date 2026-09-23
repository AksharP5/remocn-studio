import { contentRoot } from "./surface";
export const MANAGED_OBJECT = "data-studio-object";

export function managedRoot(
  element: Element,
  container: Element
): Element | null {
  const root = element.closest(`[${MANAGED_OBJECT}]`);
  return root !== null && container.contains(root) ? root : null;
}

export function managedRoots(id: string): Element[] {
  return [
    ...contentRoot().querySelectorAll(
      `[${MANAGED_OBJECT}="${CSS.escape(id)}"]`
    ),
  ];
}

export function managedIdentity(element: Element) {
  const objectId = element.getAttribute(MANAGED_OBJECT);
  const generation = element.getAttribute("data-studio-generation");
  const video = element.getAttribute("data-studio-video");
  return objectId && generation && video
    ? { generation, objectId, video }
    : null;
}
