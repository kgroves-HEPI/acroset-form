<!--
File Name: architecture.md
Project: Acroset
Description: High-level structural overview of the Acroset SPFx codebase for onboarding and handoff.
Author: Kaelan Groves
Version: 1.0.0
Created Date: 2026-04-23
Modified Date: 2026-04-23
Copyright: 2025. HEPI.
License: Proprietary.
-->

# Architecture

## Runtime Flow

1. `AcrosetFormWebPart.ts` initializes the SPFx host and shared PnPjs client.
2. `src/features/acrosetForm/AcrosetForm.tsx` renders the form and coordinates submission.
3. Lookup values are loaded from `src/features/acrosetForm/data`.
4. Calculation logic runs through `src/features/acrosetForm/calculation/compute.ts`.
5. CSV outputs are built in `src/features/acrosetForm/services/csvExport.ts`.
6. SharePoint uploads run through `src/features/acrosetForm/services/sharePointStorage.ts`.
7. The final list item is written through the shared SharePoint client.

## Folder Intent

- `src/features/acrosetForm`
  Keeps all feature-specific code in one area.
- `src/platform/sharepoint`
  Holds infrastructure shared across web parts or future features.
- `src/webparts/acrosetForm`
  Contains only SPFx shell code required by the host platform.
- `docs`
  Holds maintainership and handoff information outside runtime code.

## Source Of Truth

- UI workflow: `AcrosetForm.tsx`
- Calculation rules: `calculation/compute.ts`
- Runtime constants and paths: `config/runtimeConfig.ts`
- Lookup data: `data/*.json`
- SharePoint wiring: `platform/sharepoint/pnpjsClient.ts`
