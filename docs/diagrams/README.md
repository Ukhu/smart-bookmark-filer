# Diagram Artifacts

This directory contains durable project diagrams. The `.excalidraw` file is the
editable source of truth for each diagram. Do not treat a rendered image as an
editable source or recreate a diagram from its preview.

## Naming and previews

- Use descriptive camelCase basenames, such as `bookmarkFilingFlow.excalidraw`.
- A committed PNG or SVG preview is optional. Add one when it improves browsing
  or allows documentation to display the diagram without an Excalidraw viewer.
- Give every preview the same basename as its source, for example
  `bookmarkFilingFlow.png` or `bookmarkFilingFlow.svg`.
- Regenerate previews from the corresponding `.excalidraw` source after every
  change so the files do not diverge.

## Continue an existing diagram

Before editing a durable diagram, import its `.excalidraw` source into the local
canvas. Make and inspect the changes there, then export the updated source back
to the same path and regenerate any committed same-basename previews. Never use
the PNG or SVG preview as the starting point for an edit.

## Temporary and committed artifacts

In-memory canvas state, experiments, smoke-test scenes, and intermediate renders
are temporary. Keep them out of this directory and use an approved temporary
directory when files are needed. They may be discarded after the session.

Commit only diagrams intended to remain as project documentation. A committed
diagram must include its `.excalidraw` source; same-basename PNG or SVG previews
remain review artifacts and do not replace that source. Exporting exploratory
canvas work into this directory requires explicit user approval for each durable
file path.
