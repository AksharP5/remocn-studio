---
"remocn-studio": patch
---

The properties pane moves to dialkit 2.0, which takes back three things it had
been doing for itself. The slider now carries its own role, tab stop and
keyboard, so the wrapper that added them is gone — keeping it would have meant
a slider inside a slider. The colour control is a text field beside a swatch
that opens dialkit's own popover, so the CSS that laid a native colour input
over the swatch went with it, and nothing coerces the value any more: a colour
written as `rgb(…)` or `oklch(…)` reads as itself instead of arriving black.
The bezier curve is dialkit's too, handles and all, in place of our SVG and its
drag hook. The preview dot under it is still ours and now runs the element's
own window rather than a fixed 1.8 seconds.
