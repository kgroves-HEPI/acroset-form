# Acroset SPFx Web Part

## Purpose

This project is a SharePoint Framework (SPFx) web part used to capture Acroset measurement inputs, run the shim calculation workflow, export CSV outputs, and save a summary record to SharePoint.

This README is intended to support handoff, onboarding, and operational support. It documents what a new developer or support owner needs in order to run the app locally against the tenant workbench without changing runtime behavior.

## Scope

- Framework: SharePoint Framework `1.20.x`
- UI: React `17`
- Data access: PnPjs
- Runtime target: SharePoint tenant workbench

## Repository Location

- github: https://github.com/kgroves-HEPI/acroset-form.git

## Runtime Dependencies

The web part depends on SharePoint resources that must already exist and be accessible to the user running the app.

- SharePoint site:
  `https://hepartsint.sharepoint.com/teams/MSUSEngineering`
- Tenant workbench:
  `https://hepartsint.sharepoint.com/teams/MSUSEngineering/_layouts/15/workbench.aspx`
- SharePoint list used for saves:
  `Acroset Log`
- SharePoint folder for results CSV uploads:
  `/teams/MSUSEngineering/Acroset Data/Results`
- SharePoint folder for measurements CSV uploads:
  `/teams/MSUSEngineering/Acroset Data/Measurements`

If any of those resources are renamed, moved, or permission-restricted, the app may still load but save and upload operations will fail.

## Local Development Requirements

- Node.js `18.x`
  Expected range from `package.json`: `>=18.17.1 <19.0.0`
- npm
- Trusted SPFx localhost development certificate
- Access to the tenant and site listed above
- Permission to the required SharePoint list and folders

## Quick Start

1. Open a terminal in the SPFx app root.

   ```bash
   cd .../acroset-form/spfx
   ```

2. Confirm Node version.

   ```bash
   node -v
   ```

   Expected:

   ```text
   v18.x.x
   ```

3. Install dependencies.

   ```bash
   npm install
   ```

4. Trust the local SPFx certificate.

   ```bash
   gulp trust-dev-cert
   ```

   If the machine already has a broken or stale certificate:

   ```bash
   gulp untrust-dev-cert
   gulp trust-dev-cert
   ```

5. Start the local dev server.

   ```bash
   gulp serve
   ```

6. Open the tenant workbench using the full debug URL.

   ```text
   https://hepartsint.sharepoint.com/teams/MSUSEngineering/_layouts/15/workbench.aspx?debug=true&noredir=true&debugManifestsFile=https%3A%2F%2Flocalhost%3A4321%2Ftemp%2Fmanifests.js
   ```

7. Add the `AcrosetForm` web part from the toolbox if it is not already on the page.

## Important Notes

- This project is intended to run from the SharePoint tenant workbench, not the local workbench.
- Opening only the bare workbench URL without the `debugManifestsFile` query string will not load the local bundle.
- A certificate trust issue on `https://localhost:4321` will prevent the workbench from loading the web part.

## Operational Behavior

At a high level, the app does the following:

1. Loads local JSON lookup data from `src/data`.
2. Collects form inputs from the user.
3. Runs calculation logic from `src/utils/compute.ts`.
4. Generates results and measurements CSV content.
5. Uploads those CSV files to SharePoint folders.
6. Saves a summary list item to SharePoint.

## Key Files

- Web part entry point:
  `src/webparts/acrosetForm/AcrosetFormWebPart.ts`
- Main React component:
  `src/webparts/acrosetForm/components/AcrosetForm.tsx`
- Calculation engine:
  `src/utils/compute.ts`
- PnPjs setup:
  `src/pnpjsConfig.ts`
- Local debug serve settings:
  `config/serve.json`
- Packaging settings:
  `config/package-solution.json`

## Handoff Checklist

Before handing this project to another developer, confirm the following:

- The new owner can access the tenant workbench URL.
- The new owner can load `https://localhost:4321/temp/manifests.js` while `gulp serve` is running.
- The new owner knows which SharePoint list and folders are required.
- The new owner knows the required Node version is `18.x`.
- The new owner has the correct debug URL for tenant workbench loading.
- The new owner knows who owns the SharePoint resources and business rules.

## Ownership Template

Fill these values in before formal handoff:

- Technical owner:
  `Kaelan Groves/ MSUS ENGINEERING`
- Business owner:
  `Jill Renfroe/ IT`
- SharePoint site owner:
  `Chris Berry/ MSUS ENGINEERING`
- List schema owner:
  `Global Engineering`
- Folder/library owner:
  `Jill Renfroe / IT`
- Support contact:
  `kaelan.groves@hepi.com`
  `chris.berry@hepi.com`
  `jill.renfroe@hepi.com`

## Environment Template

Fill these values in if this app will be supported outside the current tenant or by another team:

- Production tenant URL:
  `[ENTER VALUE]`
- Non-production tenant URL:
  `[ENTER VALUE]`
- Required Azure / M365 groups:
  `[ENTER VALUE]`
- App catalog location:
  `[ENTER VALUE]`
- Deployment process:
  `[ENTER VALUE]`
- Release approver:
  `[ENTER VALUE]`

## Known Constraints

- Tenant-specific URLs and SharePoint resource names are currently embedded in configuration and code.
- The app assumes the SharePoint list and target folders already exist.
- The current codebase does not yet provide a complete authored test suite for business logic or SharePoint integration.

