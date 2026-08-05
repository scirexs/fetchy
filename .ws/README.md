# .ws/ — Workspace Index

`.ws/` holds the shared context for the multi-agent collaborative development
workflow: project architecture, design decisions, accumulated knowledge,
conventions, and per-task working materials.

This file is the index of `.ws/`. For the operating model of the agent
collaboration system, see `collaboration/agent-collaboration.md`.

## Directories

- `architecture/` — The product's own architecture.
  - `overview.md` — System overview (whole system / purpose / structure
    summary / directory layout).
- `collaboration/` — How the multi-agent development process itself works
  (reference material; not the product's own architecture).
  - `agent-collaboration.md` — Operating model of the multi-agent workflow
    (phases / agent roles / status flow / governance).
  - `json-definition.md` — Authoritative JSON schemas for the workflow's data
    (`status.json`, `report.json`, `stats.jsonl`, `signals.jsonl`, `.agent-assignment.json`).
- `decision/` — Design-intent documents (ADRs). One decision per file,
  append-only; changes are made by superseding with a new file.
- `knowledge/` — Reusable findings discovered during work.
  - `INDEX.md` — Index of knowledge files.
- `policy/` — Project conventions, rules, and formats. (`-guide` denotes
  "rule + rationale + template".)
  - `coding-style.md` — How code should be written.
  - `request-guide.md` — How to write a change request (`request.md`).
  - `knowledge-guide.md` — Guidance for authoring knowledge entries.
  - `decision-guide.md` — Spec-deciding and design-intent (ADR) authoring rules.
  - `review-guide.md` — Review criteria and the blocking / non-blocking
    boundary (`needs_fix` / `pass` split).
  - `signals-guide.md` — `causes` enum definitions for `signals.jsonl` and the
    "primary improvement target" mapping (shared vocabulary for `signal`/`opt`).
  - `optimize-guide.md` — Format, scope, and governance for process-improvement
    proposals (`.ref/z-maintainer/opt/`), shared by `feedback` (single-task) and
    `opt` (cross-task).
- `task/` — Per-task working materials.
  - `INDEX.tsv` — History of branch names / work summaries.
  - `stats.jsonl` — Model-behavior and cost-analysis statistics.
  - `signals.jsonl` — Qualitative root-cause records for document / skill improvement.
  - `.periodic-opt-state` — Last `signals.jsonl` position analyzed by the
    periodic optimizer (`opt`). Not tracked by git.
  - `.agent-assignment.json` — Model / prompt settings used by the
    orchestrator. Not tracked by git.
  - `.lock` — Orchestrator run lock (prevents concurrent runs). Not tracked by git.
  - `YYYYMMDD_xxxxxx/` — Per-task directory. Not tracked by git. Holds the
    task's `draft.md`, `status.json`, `request.md` (and `request-fixN.md`),
    `handover-notes.md`, `review-result.md`, `feedback-*.md`, transient
    report / result files, and an `archive/` of retry traces.
- `task-record/` — Archive of feature-change requests.
  - `YYYYMMDD_xxxxxx.md` — A completed `feat` task's `request.md`, renamed and
    kept as history.

## Git management

- `.ws/` is tracked by git by default except for the followings:
  - `/.ws/task/YYYYMMDD_xxxxxx/` task directories (`/.ws/task/*/`)
  - Operation-only files in the task directory (`/.ws/task/.*`)
  - Documents shared across all projects (`/.ws/collaboration/`, `/.ws/policy/*-guide.md`)
