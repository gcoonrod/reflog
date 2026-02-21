# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.1] - 2026-02-21

### Changed
- Inline deploy job in ci.yml, eliminating separate cd.yml and unreliable workflow_run trigger
- Conditional cancel-in-progress: only cancel stale PR runs, never in-flight main deployments

### Fixed
- Spurious CD runs triggered by PR CI completions despite workflow_run branch filter

## [0.3.0] - 2026-02-21

### Added
- CD pipeline with GitHub Actions for automated deployment to Cloudflare Pages
- Version guard: skip deployment when version tag already exists
- Changelog guard: require CHANGELOG.md entry for every deployed version
- Production hosting at reflog.microcode.io with automatic SSL via Cloudflare Pages
- Git tag creation on successful deployment for release tracking

## [0.2.0] - 2026-02-21

### Added
- CI pipeline with GitHub Actions (lint, typecheck, format-check, unit-tests, e2e-tests, dependency-audit)
- Dedicated CodeQL workflow for code security analysis
- Minimatch vulnerability remediation via yarn resolutions

## [0.1.0] - 2026-02-18

### Added
- Reflog MVP core: encrypted journal PWA with search, tags, and keyboard navigation
