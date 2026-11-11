# UI copy

Do not include copy that explains the detailed function or behavior of buttons,
checkboxes, switches, inputs, dialogs, or other components. This applies to
visible text, helper text, tooltips, accessibility labels and hints, and text
stored in configuration files.

Use concise action labels, field labels, validation errors, and current status.
Keep required consent and material service facts concise: what data is shared,
who receives it, whether delivery exists, and the limits of revocation. These
facts describe the service and the user's authorization, not how a control works.

Do not narrate clicks, checked defaults, control overrides, Save/Discard scope,
component state changes, or internal synchronization and validation steps. If a
control needs such an explanation, fix its label, grouping or interaction.
Keep implementation detail in developer documentation.

Examples:

- Use “Sharing preferences”, “Save sharing preferences”, and “Permission pending”.
- Do not use “This Save button applies only to this card” or “Checking Anonymous
  overrides the name, email, and phone checkboxes”.
- Use “Organization delivery is not available yet” as a service limitation.

Before merging UI changes, review every added or changed string in its rendered
context, including conditional, offline, error and accessibility states. Review
full strings and interpolated templates; a keyword search alone cannot enforce
this semantic rule. Store feature copy separately from component code.
