# Spec Delta

## Purpose

Enable project-scoped coding agents to create, inspect, refine, and preserve editable architecture and program-design diagrams through a locally operated canvas.

## ADDED Requirements

### Requirement: Project-local diagramming availability
The project SHALL provide OpenCode agents working in this repository with discoverable instructions and a configured tool connection for operating a local diagram canvas without requiring user-global OpenCode configuration.

#### Scenario: Agent discovers diagramming support
- **WHEN** an OpenCode agent works from this repository and a diagram would help explain a feature or architecture
- **THEN** the agent can discover the project-provided diagramming guidance and tool connection

#### Scenario: Other projects remain unaffected
- **WHEN** OpenCode runs in an unrelated repository without this project configuration
- **THEN** this repository's diagramming integration is not added to that project's configuration

### Requirement: Local canvas operation
The diagramming integration SHALL operate its canvas service on the loopback interface by default and SHALL support core drawing operations without an API key or hosted diagramming account.

#### Scenario: Start a local drawing session
- **WHEN** an agent invokes the configured diagramming tool on a supported local development environment
- **THEN** the canvas becomes available through a loopback URL and accepts drawing operations

#### Scenario: Remote network access is not enabled by default
- **WHEN** the canvas starts from the project-provided configuration
- **THEN** it does not bind to a non-loopback network interface

### Requirement: Iterative agent drawing workflow
The integration SHALL let an agent create and modify diagram elements, inspect a structured scene description, render the current scene, and revise the diagram based on that inspection.

#### Scenario: Agent verifies a generated diagram
- **WHEN** an agent creates an architecture or program-design diagram
- **THEN** it can inspect both scene structure and a rendered result before presenting the diagram as complete

#### Scenario: Agent corrects a visual defect
- **WHEN** inspection reveals overlapping elements, clipped labels, or unclear connections
- **THEN** the agent can update the affected elements and render the revised scene again

### Requirement: Diagram-assisted OpenSpec exploration
The project-provided `/opsx-explore` guidance SHALL be able to use the local diagramming integration as an interactive visual reasoning instrument while preserving its constructive discovery behavior and its separation from implementation.

#### Scenario: Explore architecture visually
- **WHEN** a user asks during `/opsx-explore` to create or revise an architectural diagram
- **THEN** the agent can inspect relevant context, operate a transient local canvas, discuss the rendered result with the user, and iteratively revise it without leaving exploration mode

#### Scenario: Transient drawing does not imply persistence
- **WHEN** the user authorizes creation or revision of an exploratory diagram
- **THEN** that authorization covers the transient local drawing session but does not authorize repository file changes, OpenSpec artifact edits, or external sharing

#### Scenario: Persist an exploratory diagram
- **WHEN** an exploratory diagram becomes useful as durable project documentation
- **THEN** the agent identifies the proposed editable source and preview paths and obtains explicit user approval before exporting them to the repository

### Requirement: Durable editable diagram artifacts
The integration SHALL support exporting an editable `.excalidraw` source under `docs/diagrams/`, re-importing that source for later refinement, and rendering a reviewable image from the saved source.

#### Scenario: Preserve a completed diagram
- **WHEN** an agent completes a diagram intended to remain with the project
- **THEN** it exports an editable source file under `docs/diagrams/` and can produce a rendered preview from that source

#### Scenario: Continue an existing diagram
- **WHEN** an agent is asked to update a previously exported diagram
- **THEN** it imports the existing `.excalidraw` source and refines it instead of recreating the diagram from an image

### Requirement: Explicit external sharing boundary
The project guidance SHALL distinguish local drawing and export from optional external sharing, and SHALL require an explicit user request before an agent uploads or creates a hosted share link for a diagram.

#### Scenario: Normal diagram creation stays local
- **WHEN** an agent draws, inspects, renders, and exports a diagram without a sharing request
- **THEN** it does not invoke the external sharing operation

#### Scenario: User requests a share link
- **WHEN** a user explicitly asks the agent to create an externally accessible diagram link
- **THEN** the agent may invoke the documented sharing operation after identifying that it uploads encrypted scene data to the configured external service

### Requirement: Actionable setup failure
The integration SHALL expose a clear failure when its pinned package cannot start, the configured port is unavailable, or the canvas cannot be reached, without treating a partial or missing diagram as a successful export.

#### Scenario: Canvas startup fails
- **WHEN** the local canvas process cannot start or cannot be reached
- **THEN** the agent reports the failure and does not claim that the requested diagram was completed

#### Scenario: Export fails
- **WHEN** the editable source or requested preview cannot be written to its target path
- **THEN** the agent reports which artifact was not produced and preserves any successfully written artifact
