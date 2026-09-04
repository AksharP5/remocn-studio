// A `<video>` that leaves the DOM keeps its media player — and every decoded
// frame it holds — alive in WebKit's GPU process until the element is garbage
// collected, and on a paused page that collection does not come for a minute
// or more. Remotion's `OffthreadVideo` previews through a plain `<video>`
// inside the scene's `<Sequence>`, which unmounts at the end of the
// composition and mounts again on the next loop: a new element per loop, and
// measured 1.3–1.6 GB of footprint added on each one, never given back until
// the page unloaded. Remotion's own unmount only detaches its listeners and
// its audio node. Clearing the source and calling `load()` on the detached
// element is what tells WebKit to tear the player down now.
const MEDIA = "video, audio";

export function releaseDetachedMedia(container: Node): () => void {
  const observer = new MutationObserver((records) => {
    const detached: HTMLMediaElement[] = [];

    for (const record of records) {
      for (const node of record.removedNodes) {
        collect(node, detached);
      }
    }

    if (detached.length === 0) {
      return;
    }

    // A node React moves is removed and inserted in the same commit, so the
    // decision waits for the DOM to settle and asks whether the element is
    // really gone rather than releasing what is about to be shown again.
    queueMicrotask(() => {
      for (const media of detached) {
        if (!media.isConnected) {
          release(media);
        }
      }
    });
  });

  observer.observe(container, { childList: true, subtree: true });

  return () => observer.disconnect();
}

export function release(media: HTMLMediaElement): void {
  media.pause();
  media.removeAttribute("src");
  media.load();
}

function collect(node: Node, into: HTMLMediaElement[]): void {
  if (node instanceof HTMLMediaElement) {
    into.push(node);
  }

  if (node instanceof Element) {
    into.push(...node.querySelectorAll<HTMLMediaElement>(MEDIA));
  }
}
