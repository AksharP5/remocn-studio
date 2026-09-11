---
"remocn-studio": minor
---

Settings has an Integrations section: services the studio can reach with your
own account.

- **ElevenLabs and Figma can be connected**, with an API key and a personal
  access token. Choose the service, paste the key, the studio checks it with
  the service before keeping anything, and you name the connection. Several
  accounts of one service are allowed and told apart by name. Check,
  reconnect, disable and remove are on each row; removing asks first and says
  plainly when the service itself could not be told.
- **Each key lives in this Mac's keychain, in an entry of its own**, and never
  reaches a chat, a model, a log or your project. A key that is stored is never
  shown back — replacing it means typing a new one.
- **A turn can ask which services are connected** and what each may be used
  for, and is told about connections you have checked and left enabled. It is
  never told the key.
- **AI Accounts moved** out of its own row in the rail and into Integrations,
  where it sits beside the services as its own group. Nothing about it changed:
  the studio still only probes your own signed-in CLI.
- **Stock media left Settings.** The Pexels key was never yours to change — the
  build ships one — so the section is gone and the Assets pane says so directly
  when a build carries no key.
