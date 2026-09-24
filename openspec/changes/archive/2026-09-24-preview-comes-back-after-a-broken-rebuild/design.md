## Where the decision is made

The host's watch callback already keeps a `BuildState` for the render pin, and that state remembers whether the last settled compile failed. Reading it with `Ref.getAndUpdate` as the successful compile settles is enough to know whether this compile heals a failure. `recovering(previous)` is the one predicate, next to `pinnable` and `troubleIn`, so the rule is testable without webpack.

## Why the host and not the hook

The hook could keep the last served url and go back to it on a fresh `building` sequence, but it would be guessing that the rebuild succeeded from the absence of a `failed` event. The host knows; it says so.

## Order of the two announcements

On a healed compile the rebuild notification runs first (still cache forgotten, session dropped, any page listener pinged), then `ready` is sent. A page that is still mounted for some reason sees a rebuild and a same-url `ready`, which `usePreview` treats as a no-op.
