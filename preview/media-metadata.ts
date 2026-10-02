export function deferEmptyMediaMetadata(root: ShadowRoot): () => void {
  const pending = new WeakSet<HTMLMediaElement>();

  const metadata = (event: Event) => {
    const media = event.target;
    if (!(media instanceof HTMLMediaElement)) {
      return;
    }
    if (media.duration !== 0) {
      pending.delete(media);
      return;
    }
    // WebKit can announce loaded audio with zero duration after a reload.
    // Remotion cannot loop it until durationchange supplies the real value.
    pending.add(media);
    event.stopImmediatePropagation();
  };
  const duration = (event: Event) => {
    const media = event.target;
    if (
      !(
        media instanceof HTMLMediaElement &&
        pending.has(media) &&
        media.duration > 0
      )
    ) {
      return;
    }
    pending.delete(media);
    media.dispatchEvent(new Event("loadedmetadata"));
  };

  root.addEventListener("loadedmetadata", metadata, true);
  root.addEventListener("durationchange", duration, true);
  return () => {
    root.removeEventListener("loadedmetadata", metadata, true);
    root.removeEventListener("durationchange", duration, true);
  };
}
