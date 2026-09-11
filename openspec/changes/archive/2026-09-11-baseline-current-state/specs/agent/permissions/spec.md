## Purpose

Everything the agent does inside the opened folder runs without interruption; everything that reaches outside it, or runs a command, is put to the person as an Allow/Deny card above the composer. This capability is that gate, the three permission modes a chat can run in, and what each provider's runtime can and cannot enforce.

## ADDED Requirements

### Requirement: The gate decides by resolved path, not by the text of the path

The studio SHALL resolve every path a tool names — following symlinks and `..`, and walking up to the nearest existing ancestor so a file that is about to be created still resolves — and SHALL allow a file tool without a card only when every path it names lands inside the opened folder.

#### Scenario: A file inside the folder

- **WHEN** the agent reads, writes or edits a path that resolves inside the opened folder, given absolutely or relative to it
- **THEN** the call runs with no card

#### Scenario: A file that does not exist yet

- **WHEN** the agent writes to a path whose file has not been created
- **THEN** the path is resolved through its nearest existing ancestor, and a target inside the folder still runs with no card

#### Scenario: A symlink leading out

- **WHEN** a path inside the folder is a symlink whose target is outside it
- **THEN** a card is raised, and the card names the resolved destination rather than the link

#### Scenario: A path climbing out of the folder

- **WHEN** the agent names a path that resolves outside the opened folder
- **THEN** a card is raised with the reason that the path is outside the project

### Requirement: Commands and unrecognised tools always ask

The studio SHALL raise a card for every command execution regardless of what it touches, and for every tool it has no path rule for, and SHALL allow without a card only the agent's own plan and task bookkeeping and the studio's own tools.

#### Scenario: A shell command

- **WHEN** the agent runs a command
- **THEN** a card is raised carrying the command, whatever the command touches

#### Scenario: A tool with no path rule

- **WHEN** the agent calls a tool the gate has no path rule for, including a tool from any server other than the studio's own
- **THEN** a card is raised

#### Scenario: The studio's own tools and the agent's bookkeeping

- **WHEN** the agent calls one of the studio's own tools, or creates, updates, lists or reads its own task list
- **THEN** the call runs with no card

#### Scenario: A search with no path

- **WHEN** the agent searches without naming a path
- **THEN** nothing resolves outside the opened folder and the call runs with no card

### Requirement: The shipped knowledge bundle is readable, never writable

The studio SHALL allow the read-only file tools to reach the skills bundle it ships, and SHALL raise a card for any write into it and for any symlink inside it that leads out.

#### Scenario: A skill page is read

- **WHEN** the agent reads, globs, greps or reads a notebook inside the shipped bundle
- **THEN** the call runs with no card, so following a skill's own links costs no interruption

#### Scenario: A write into the bundle

- **WHEN** the agent writes or edits inside the shipped bundle
- **THEN** a card is raised

#### Scenario: A link out of the bundle

- **WHEN** a path inside the bundle resolves outside both the bundle and the opened folder
- **THEN** a card is raised

### Requirement: Three modes, and what each guarantees

The studio SHALL offer exactly three permission modes — auto, accept edits and plan — and SHALL make the rule that anything outside the folder always asks absolute in accept edits and plan by forcing every call through the gate before the provider's own classifier can approve it. It SHALL NOT offer a mode that skips the gate.

#### Scenario: Accept edits or plan

- **WHEN** a chat runs in accept edits or plan and the agent runs a command or names a path outside the folder
- **THEN** the call reaches the gate and a card is raised, whatever the provider's own classifier would have decided

#### Scenario: Auto

- **WHEN** a chat runs in auto
- **THEN** no such forcing is installed, and the provider's own classifier may approve a call the gate would have stopped

#### Scenario: A call the provider refused on its own

- **WHEN** the provider declines a call without consulting the gate
- **THEN** the refusal is folded into a notice in the chat, naming the tool and the reason, rather than showing as nothing but a failed row

#### Scenario: A mode that skips the gate

- **WHEN** any mode is offered anywhere in the studio
- **THEN** it is one of the three, and no bypass or never-ask mode is offered

### Requirement: The mode belongs to the chat

The studio SHALL keep the permission mode per chat, SHALL send it with every turn of that chat, and SHALL persist a mode picked between turns so it survives a relaunch.

#### Scenario: The mode is changed between turns

- **WHEN** the person changes the mode chip on a chat that has a stored row
- **THEN** the mode is stored against that chat and the chat comes back in it

#### Scenario: A chat that has not spoken yet

- **WHEN** the mode is changed on a draft chat with no stored row
- **THEN** the choice is kept with the draft and used by its first turn

#### Scenario: The mode reaches the turn

- **WHEN** a turn starts
- **THEN** it runs under the mode its own chat is set to, and the stored mode and the mode the turn ran under cannot diverge

### Requirement: A model that cannot run the mode is reported, never claimed

The studio SHALL ask the provider which mode the turn actually started in, SHALL raise a notice when that differs from the mode requested, and SHALL show the mode the turn will really run in rather than the mode that was asked for.

#### Scenario: A Claude model without auto

- **WHEN** a chat is set to auto and its model does not offer auto
- **THEN** the chip reads the mode the turn will really run in with the reason on its tooltip, the auto row in the menu is disabled with that reason, and the chat keeps auto so moving back to a model that has it restores the mode without choosing again

#### Scenario: The provider ran a different mode

- **WHEN** the provider reports it started the turn in a mode other than the one requested
- **THEN** a notice says which mode it ran in, naming the model when the model is the known cause and keeping a plain sentence otherwise

### Requirement: Plan mode ends in a card

The studio SHALL treat the agent's request to leave plan mode as a permission card carrying the plan itself, SHALL offer to approve into a named mode or to send the plan back, and SHALL apply an approved mode to the running turn so the same turn starts building.

#### Scenario: The agent presents a plan

- **WHEN** the agent asks to leave plan mode
- **THEN** a card is raised whose body is the plan markdown, offering to approve into accept edits, to approve into auto, to keep planning, or to cancel the turn

#### Scenario: The plan is approved

- **WHEN** the person approves into a mode
- **THEN** the running turn is switched into that mode, the chat's stored mode is updated and re-streamed, and the same turn carries on building

#### Scenario: The plan is sent back

- **WHEN** the person chooses to keep planning
- **THEN** the agent is told to stay in plan mode, ask what should change and present a revised plan, and the chat's mode is unchanged

### Requirement: An ask is a chunk of its own turn

The studio SHALL deliver a permission ask as a chunk of the stream of the turn that raised it, SHALL accept the answer as a separate request, and SHALL show the card only in the chat that turn belongs to.

#### Scenario: A background chat asks

- **WHEN** a turn in a chat that is not on screen raises a card
- **THEN** that chat's row is marked as waiting, its own composer stays locked, and the card is answered when the person opens that chat

#### Scenario: The turn ends before the card is answered

- **WHEN** the turn that raised a card ends for any reason
- **THEN** the card is gone with it, and nothing outlives the turn

#### Scenario: Answering while another request is in flight

- **WHEN** the person answers a card while the turn that raised it is still streaming
- **THEN** the answer is served immediately rather than waiting behind the turn

### Requirement: One card at a time, above the composer

The studio SHALL show the oldest outstanding card of the open chat above the composer rather than in the transcript, SHALL lock that chat's composer while a card is up, SHALL put the keyboard on the card, and SHALL remove the card when it is answered.

#### Scenario: One assistant message raises several calls

- **WHEN** more than one card is outstanding for the open chat
- **THEN** exactly one is on screen, the oldest, and answering it reveals the next

#### Scenario: A card is up

- **WHEN** a card is showing
- **THEN** the composer is disabled and reads that the approval request has to be answered to continue, and the first choice on the card holds focus

#### Scenario: Escape

- **WHEN** the person presses Escape on a card
- **THEN** the card's own declining choice is taken — Decline for an ordinary call, Keep planning for a plan

#### Scenario: The card is answered

- **WHEN** a choice is taken
- **THEN** the card leaves the screen and what the tool then did is left to the activity row to say

### Requirement: An unanswered card is denied after ten minutes

The studio SHALL deny a permission ask that has gone unanswered for ten minutes, and SHALL count that wait upward in the chats pane rather than counting down to the deadline.

#### Scenario: Nobody answers

- **WHEN** a card has been outstanding for ten minutes
- **THEN** it is denied and the agent is told it may not run that call

#### Scenario: A chat is waiting

- **WHEN** a chat has an outstanding card
- **THEN** its row reads how long it has been waiting, and waiting chats lead the pane

### Requirement: Remembered approvals live only in the running studio

The studio SHALL remember an "always allow" only for the exact call it was given for, only for the life of the sidecar process, and SHALL NOT write it to disk or remember a denial.

#### Scenario: The same command again

- **WHEN** a call whose exact signature was approved with "always allow this session" is made again
- **THEN** it runs with no card, in any chat of that studio run

#### Scenario: A denial

- **WHEN** a call is declined
- **THEN** nothing is remembered, and the same call asks again

#### Scenario: The sidecar restarts

- **WHEN** the sidecar restarts or the app is relaunched
- **THEN** every remembered approval is gone

### Requirement: Stopping a turn settles its cards first

The studio SHALL refuse every card still outstanding for a turn before it waits for that turn's agent to stop, and SHALL leave cards belonging to other turns alone.

#### Scenario: Stop with a card up

- **WHEN** a turn carrying an outstanding card is stopped
- **THEN** that card is refused before the agent is asked to stop, and the turn ends

#### Scenario: Another turn's cards

- **WHEN** one turn's cards are abandoned
- **THEN** a card raised by a different turn is untouched and still answerable

### Requirement: Codex has no cards, and its sandbox is the gate

The studio SHALL never show a permission card for a Codex turn, SHALL run Codex with approvals disabled, and SHALL map the three modes onto Codex's own sandbox so a write outside the folder is blocked rather than asked about.

#### Scenario: Auto or accept edits on Codex

- **WHEN** a Codex turn runs in auto or accept edits
- **THEN** it runs in a workspace-write sandbox, where a write outside the opened folder is refused by the sandbox and no card is raised

#### Scenario: Plan on Codex

- **WHEN** a Codex turn runs in plan
- **THEN** it runs read-only

#### Scenario: The studio's own tools on Codex

- **WHEN** a Codex turn calls one of the studio's own tools
- **THEN** the call is pre-approved rather than left to the runtime's own judgement

### Requirement: Providers on the Agent Client Protocol answer with the options they were offered

The studio SHALL answer a protocol permission request by applying the same rules — command execution always asks, file work whose every location resolves inside the opened folder runs silently, anything else asks — and SHALL choose only among the options the agent itself offered, cancelling the request when none of them fits.

#### Scenario: File work inside the folder

- **WHEN** the agent asks permission for a file operation whose every location is inside the opened folder
- **THEN** an allow option is chosen without raising a card

#### Scenario: A command, or a location outside the folder

- **WHEN** the agent asks permission to execute a command, names a location outside the folder, or offers a kind with no locations at all
- **THEN** a card is raised, and the answer picks the agent's own allow-once, allow-always or reject option

#### Scenario: The agent offered nothing that fits

- **WHEN** the answer needs an option the agent did not offer
- **THEN** the request is cancelled rather than an option being invented
