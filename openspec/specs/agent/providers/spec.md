# agent/providers Specification

## Purpose
Four agents can drive a chat — Claude Code, Codex, Copilot and Grok Build — behind one seam, each through the person's own installed command-line tool and their own login. This capability is what a provider is allowed to differ in, how one is chosen, how the studio finds out whether it can be used, and what the studio does when a provider cannot do something the others can.

## Requirements

### Requirement: Four providers behind one seam

The studio SHALL support exactly four providers, SHALL default a chat to Claude, and SHALL treat everything a turn needs — the permission gate, the mode, the studio's own tools, the transcript and the history row — as provider-neutral, so a provider differs only in how it is started, what it can do and how its failures are worded.

#### Scenario: A turn on any provider

- **WHEN** a turn runs on any of the four providers
- **THEN** it streams the same kinds of event, records the same transcript and answers with the same shape of result

#### Scenario: A stored chat written before providers existed

- **WHEN** a chat row or a stored turn carries no provider
- **THEN** it reads as Claude

### Requirement: Capabilities decide what the composer shows

The studio SHALL declare, per provider, whether it offers permission modes, reasoning effort, a context-window reading, a plan tool, resuming and streamed thinking; and the composer SHALL render the Mode and Effort chips only for a provider that claims them.

#### Scenario: A provider that claims modes and effort

- **WHEN** the open chat's provider claims modes and effort
- **THEN** the Mode and Effort chips are on the composer

#### Scenario: A provider with no context reading

- **WHEN** the provider never reports how full its context window is
- **THEN** no context meter appears

#### Scenario: A provider with no plan tool

- **WHEN** the provider's own task tool does not speak the vocabulary the plan checklist is built from
- **THEN** no plan drawer and no checklist appear

### Requirement: The provider belongs to the chat

The studio SHALL keep the provider as a property of the chat, SHALL send it with every turn of that chat, and SHALL allow it to be changed only while the chat is still a draft that has not spoken.

#### Scenario: A draft chat

- **WHEN** a chat has no stored row, no transcript and no resume token, and no turn is running
- **THEN** the provider can be changed, and picking a model in another provider's group switches the chat to that provider

#### Scenario: A chat that has spoken

- **WHEN** a chat has any history or a resume token
- **THEN** every other provider's group is disabled, with the reason that this chat already speaks another provider and a new chat is needed to switch

#### Scenario: A queued message goes out

- **WHEN** a queued message is dispatched
- **THEN** it runs on the chat's provider as it stands then, rather than on a provider captured when the message was written

### Requirement: One Model menu, grouped by provider

The studio SHALL present model and provider as one menu, grouped by provider with that provider's models inside, and SHALL mark a provider whose probe failed with a word saying what is needed and lead to Settings › AI Accounts rather than offering its models.

#### Scenario: Picking a model

- **WHEN** the person opens the Model menu
- **THEN** every provider is a group, the chat's own provider shows which of its models is chosen, and choosing one closes the menu

#### Scenario: A provider that is not signed in or not installed

- **WHEN** a provider's probe answered failed
- **THEN** its group is not openable, it is marked "Sign in", "Not installed" or "Unavailable", its own detail is on the tooltip, and clicking it opens Settings › AI Accounts focused on that provider

#### Scenario: A provider that has not been probed yet

- **WHEN** no row has come back for a provider
- **THEN** it is presented plainly with no mark, so an unprobed provider never reads as signed out

### Requirement: The model choice is per provider and remembered

The studio SHALL keep one chosen model per provider in its settings, SHALL send the model of the chat's own provider with a turn, and SHALL treat an empty choice as "let the provider decide".

#### Scenario: Switching providers

- **WHEN** the chat's provider changes
- **THEN** the model shown and sent is the one chosen for that provider, not the one chosen for the previous provider

#### Scenario: The default entry

- **WHEN** the chosen model for a provider is its "Default" entry
- **THEN** no model is named in the turn and the provider picks for itself

#### Scenario: A model the catalog does not list

- **WHEN** a stored choice names a model not in the provider's list
- **THEN** it is still shown and sent, under its own name

### Requirement: Reasoning effort and mode are mapped into each provider's own scale

The studio SHALL keep one reasoning-effort setting across providers and SHALL map it into whatever each provider's own command-line tool accepts, clamping rather than passing a value the tool does not enumerate.

#### Scenario: An effort above what a provider offers

- **WHEN** the effort is set above the range a provider accepts
- **THEN** it is clamped into that provider's own highest accepted level rather than sent verbatim

#### Scenario: Modes on a protocol-driven provider

- **WHEN** a turn runs on a provider driven over the Agent Client Protocol
- **THEN** plan enters that agent's plan mode and auto and accept edits enter its ordinary agent mode; its own allow-everything mode is never entered
- **AND** a mode the agent does not offer leaves the session in the mode it opened in, with the reason logged rather than failing the turn

### Requirement: The command-line tool is the person's own, resolved and never bundled

The studio SHALL locate each provider's command-line tool by its own environment override first, then the search path, then the usual install locations, SHALL never ship or update one, and SHALL check no version.

#### Scenario: An override is set

- **WHEN** the provider's environment override names a path
- **THEN** that path is used when it exists, and the provider counts as not installed when it does not — the override is never quietly overtaken by a copy found elsewhere

#### Scenario: A tool installed where a windowed app sees no path

- **WHEN** the tool is in one of the usual install directories but not on the path the app inherited
- **THEN** it is still found

#### Scenario: The tool is not on the machine

- **WHEN** no executable is found for a provider
- **THEN** its row reads that it is not installed and carries the command to install it, and a turn sent on that provider answers with the same sentence rather than a stack trace

### Requirement: Each provider is probed in its own way

The studio SHALL answer, per provider, whether it is installed and signed in, using a probe that costs no model call, and SHALL report anything else it cannot interpret as "could not answer" with the command to run in a terminal.

#### Scenario: Claude

- **WHEN** Claude Code is asked who is signed in
- **THEN** a logged-out answer reads as not signed in with the sign-in command, an answer carrying a subscription or an email reads as signed in, and an account authenticated through another cloud provider reads as signed in through that provider

#### Scenario: Codex

- **WHEN** the Codex tool is asked for its login status
- **THEN** a clean exit reads as logged in with what it said, "not logged in" reads as not signed in with the sign-in command, and anything else reads as could not answer

#### Scenario: Copilot and Grok

- **WHEN** a protocol-driven provider is probed
- **THEN** the probe opens a session and asks for no model; an authentication-required answer reads as not signed in, an opened session reads as logged in with the tool's version, and a failure to start reads as could not start

#### Scenario: A block the probe cannot see

- **WHEN** an account is blocked by an organisation policy rather than signed out
- **THEN** the probe reports signed in, and the block reaches the person only when a turn meets it

### Requirement: Probes are asked once per run, shared, and rechecked on demand

The studio SHALL probe each provider at most once per run of the sidecar, SHALL share that answer with the environment checklist, SHALL refresh every probe when the person asks for a recheck, and SHALL recheck by itself when the window regains focus while a provider is failing.

#### Scenario: A warm answer

- **WHEN** a provider row is asked for again in the same run
- **THEN** the cached answer is given and no probe runs

#### Scenario: Recheck

- **WHEN** the person presses Recheck in Settings › AI Accounts
- **THEN** every cached answer is dropped and all four providers are probed again

#### Scenario: Coming back from the terminal

- **WHEN** a provider row is failing and the window regains focus
- **THEN** the probes are run again, at most once every five seconds, so a sign-in done in a terminal turns the row green with no button

### Requirement: Only the chat's own provider being signed out locks the composer

The studio SHALL lock the composer for a chat when that chat's own provider reports it is not usable, and SHALL leave chats on other providers alone.

#### Scenario: One provider is signed out

- **WHEN** one provider's row is failing
- **THEN** chats on that provider cannot send, and chats on the other providers are unaffected

#### Scenario: A project that is not a Remotion project

- **WHEN** the project fails a check other than the provider's own sign-in
- **THEN** the composer is not locked, and the message can still be sent

### Requirement: A provider's failures reach the person in words

The studio SHALL classify each provider's own failures into being signed out, being out of quota, an unusable model, or something else, SHALL word the sign-in case as an instruction, and SHALL never let a provider's failure end a turn silently.

#### Scenario: A model the account may not use

- **WHEN** a provider refuses the chosen model
- **THEN** the turn fails with the provider's own sentence, including the case where the model needs a newer command-line tool than the person has — the studio never installs or updates one

#### Scenario: A login failure reported as ordinary message text

- **WHEN** a provider answers a turn with a message whose whole opening is one of its known login-failure sentences
- **THEN** it is converted into a sign-in failure and the composer reports it as such, rather than being shown as the agent's answer

#### Scenario: An answer that merely mentions an error

- **WHEN** a turn's answer talks about errors without being one of those exact shapes
- **THEN** it is left alone and shown as the agent's answer

### Requirement: Tool rows speak one vocabulary whoever ran the tool

The studio SHALL translate each provider's own tool names into one neutral set of verbs carried on the streamed call and on the stored row, and SHALL fall back to the tool's own name when no translation exists.

#### Scenario: The same work on two providers

- **WHEN** two providers each read a file
- **THEN** both rows carry the same verb and the same icon

#### Scenario: A tool nothing translates

- **WHEN** a provider names a tool with no neutral verb, including the studio's own tools
- **THEN** the row shows the tool's own name and a generic mark rather than nothing

### Requirement: What a provider cannot do is said out loud, never dropped in silence

The studio SHALL tell the person, in the chat, when a provider cannot carry part of a message, and SHALL never send a provider content it cannot read without saying so.

#### Scenario: A provider that cannot look at pictures

- **WHEN** a turn carrying attached images runs on a provider whose protocol says it cannot read them
- **THEN** the pictures are not sent and a notice in the chat says so

#### Scenario: Resuming

- **WHEN** a chat continues on the provider it started with
- **THEN** the provider's own resume token is used, and a token is never carried across providers

#### Scenario: Stopping a turn on Codex

- **WHEN** a Codex turn is stopped
- **THEN** the child process is aborted and the studio absorbs the one error that abort can raise, so stopping never takes the sidecar down or reports itself as a crash

#### Scenario: A protocol-driven provider is resumed

- **WHEN** a chat is resumed over the Agent Client Protocol and the agent replays the whole conversation before answering
- **THEN** the replay is ignored, and only what happens after the session is open reaches the chat
