---
"remocn-studio": patch
---

The bundled bun runtime moves from 1.3.2 to 1.4.2, and the test suite runs on
`bun test` instead of Vitest: the same 2406 tests in a quarter of the wall clock
and a fifth of the CPU. The properties pane's asset picker now lists a
project's `public/` in a stable order, whatever order the file system hands
the entries back in.
