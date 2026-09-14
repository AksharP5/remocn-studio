# Integrations settings

Approved direction: service cards with an inline, three-stage connection flow.

Show each provider's identity and capabilities in readable language. Separate the
connection name, account, and status. Give empty settings a useful introduction
and one add action. Preserve the existing settings palette and component system.

The flow shows Service → Access → Connect. Authorization explains the selected
service and local credential storage, reports errors beside the input, and shows
progress while checking. The last stage confirms verification and requests a
connection name before saving. Keep cancellation and existing connection controls.

Implementation sequence:
1. Add provider identity, capability descriptions, and stage presentation.
2. Restructure empty, selection, authorization, naming, and connection states.
3. Verify existing integration tests; cover the successful flow and inline errors.
4. Run TypeScript and scoped formatting/lint checks.

Use wrapping layouts, accessible form labels, native form submission, and the
existing semantic status tokens. Do not change credential storage or IPC contracts.
