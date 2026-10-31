# Routing notes

Moved out of project_instructions.md. Read the part your task needs.

## Template routing

- New feature or sprint implementation note -> [documentation.md](documentation.md) -> [feature implementation draft](../templates/feature-implementation-draft.md)
- New or updated UI/UX design decision -> [using-design-decisions.md](ui-ux/reference/using-design-decisions.md) -> [design decision template](ui-ux/reference/design-decision-template.md)

## Manual QA

For manual Android MVP QA, read [qa_checklist.md](../qa_checklist.md) for the canonical end-to-end coverage across launch, permissions, capture, annotation, submission, recovery, network, and device conditions.

## The `docs/` folder

`docs/` is a normal folder in this repository. Commit doc changes with the code
they describe, in the same pull request. A checkout made before the merge of
the former `feral-spotter-docs` repo still has `docs/` as a submodule; re-clone
or see the migration pull request for the steps.
