# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2026-04-07
### Added
- First public CLI for Bee-Audit orchestration.
- Core audit system supporting static checks, typings, and tests.
- Internal baseline SAST pattern analyzer.
- Secrets scanning integration via Gitleaks.
- Dependency audit parsing capabilities.
- **Phase 1 Stage 1:** Native integration for **Semgrep CE** SAST scanning and reporting.
- Graceful missing binary skips for external tools.
- Unified Policy evaluation engine (Scores: Quality, Security, Dependencies, Runtime).
- `summary.md` and `details.json` dual reporting engine.
