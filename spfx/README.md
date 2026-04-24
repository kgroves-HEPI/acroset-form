<!--
File Name: README.md
Project: Acroset
Description: Repository overview and navigation guide for the Acroset SPFx project.
Author: Kaelan Groves
Version: 1.0.0
Created Date: 2026-04-23
Modified Date: 2026-04-23
Copyright: 2025. HEPI.
License: Proprietary.
-->

# Acroset SPFx

This repository contains the Acroset SharePoint Framework web part used to capture measurement inputs, run shim calculations, export CSVs, and save a SharePoint record.

## Repository Map

- `src/features/acrosetForm`
  Main Acroset feature code grouped by concern:
  - `AcrosetForm.tsx` for UI and submission flow
  - `calculation/` for regression and shim math
  - `config/` for runtime constants and thresholds
  - `data/` for lookup JSON files
  - `services/` for CSV export and SharePoint file upload helpers
  - `validation/` for measurement and retainer checks
- `src/platform/sharepoint`
  Shared SharePoint client initialization
- `src/webparts/acrosetForm`
  SPFx web part host and manifest
- `docs`
  Handoff, architecture, and dependency documentation

## Quick Start

1. Use Node `18.17.1`.
2. Run `npm install`.
3. Run `gulp trust-dev-cert`.
4. Run `gulp serve`.
5. Open the tenant workbench URL from [docs/handoff.md](/Users/kaelangroves/DEV/acroset-form/spfx/docs/handoff.md:1).

## Documentation

- [Architecture](/Users/kaelangroves/DEV/acroset-form/spfx/docs/architecture.md:1)
- [Handoff](/Users/kaelangroves/DEV/acroset-form/spfx/docs/handoff.md:1)
- [SharePoint Dependencies](/Users/kaelangroves/DEV/acroset-form/spfx/docs/sharepoint-dependencies.md:1)
- [Calculation Validation Logic](/Users/kaelangroves/DEV/acroset-form/spfx/docs/calculation-validation-logic.md:1)
