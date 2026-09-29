# Documentation Terminology Cleanup Plan

## Objective

Remove product release labels from Xeroww documentation so the repository describes capabilities, architecture, and delivery stages without tying them to numbered product releases. Preserve technical identifiers that are required for compatibility, dependency resolution, database concurrency, API routing, schema evolution, and deterministic formula provenance.

## Architecture

This change is documentation-focused. Runtime architecture, route contracts, persistence models, and analytical calculations remain unchanged. Documentation will distinguish between:

- Current runtime capabilities
- Near-term product priorities
- Future architecture that remains conditional on scale and validated demand

The modular monolith remains the current architecture. Kafka, stream processing, and analytical storage remain future options rather than implied release commitments.

## Files and modules to change

- Root and database README files
- Canonical context in `context-folder/context-file.md`
- Architecture, formula, pattern, release-note, ADR, and implementation-plan documents under `docs/`
- Documentation filenames that contain obsolete product release labels
- Grafana dashboard display metadata when it presents a Xeroww product release label

Runtime files will only be changed if they contain user-facing product release language. Technical uses of `version`, such as optimistic concurrency fields, event schema identifiers, package versions, API paths, migration directories, and formula identifiers, will remain intact.

## Components and concepts involved

- Product overview and capability descriptions
- Current and future architecture diagrams
- Decision Workbench documentation
- Replay and Behaviour Lab documentation
- Portfolio Intelligence documentation
- Historical implementation plans
- Operational dashboard title and tags

## Data flow and control flow

No runtime data flow changes are planned. Documentation diagrams will continue to show the existing provider-to-cache-to-service-to-API-to-client flow and the possible future ingestion flow. Labels will use capability stages such as current runtime, streaming integration, stream processing, and analytical storage.

## Interfaces and APIs

No API contracts will change. Paths such as `/api/v1`, response fields such as `version`, and request fields such as `expected_version` are compatibility interfaces and will be preserved. Documentation prose will avoid presenting those technical identifiers as Xeroww product releases.

## Dependencies

No dependency changes are required for the documentation cleanup. Existing uncommitted frontend dependency and cursor work will be validated and included in the requested consolidated commit.

## Edge cases

- Do not rewrite dependency versions in package manifests or container images.
- Do not rename Alembic migration infrastructure or alter migration identifiers.
- Do not remove optimistic concurrency fields from decision, replay, or portfolio models.
- Do not remove deterministic algorithm and formula identifiers used for reproducibility.
- Do not rewrite `/api/v1` because it is an API namespace, not a product release label.
- Historical plans must remain understandable after milestone labels are replaced with capability names.
- Links must be updated when documentation files are renamed.

## Error handling

Repository-wide searches will detect remaining product release labels and broken references. Any ambiguous occurrence will be reviewed in context. Test failures caused by the existing frontend changes or documentation references will be repaired when they are within the requested scope.

## Performance considerations

Documentation edits have no runtime performance impact. The existing premium cursor and motion changes will be checked through the frontend test, lint, and production build commands. Bundle warnings will be reported accurately if they remain.

## Testing considerations

Validation will include:

1. Repository-wide search for obsolete Xeroww release labels in documentation and display metadata.
2. Search for references to renamed documentation files.
3. Markdown link and whitespace checks where available.
4. Full backend automated test suite.
5. Frontend test suite.
6. Frontend lint.
7. Frontend production build.
8. Final Git diff and status review before committing.

## Implementation steps

1. Inventory product release labels in Markdown, text documentation, and operational display metadata.
2. Classify each match as obsolete product terminology or a required technical compatibility identifier.
3. Rename documentation files whose names contain obsolete release labels.
4. Replace product release headings and prose with capability-based language.
5. Update diagrams, tables, links, and historical plan language to remain coherent.
6. Update operational dashboard display metadata that exposes an obsolete product label.
7. Run repository-wide terminology and reference audits.
8. Run backend and frontend validation.
9. Repair in-scope failures and repeat the relevant checks.
10. Review all outstanding changes and create one Conventional Commit containing the documentation cleanup and previously unfinished frontend work.
