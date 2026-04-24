# Tenant Workbench Setup

## Purpose

This document explains how a new user can run the Acroset SPFx web part in the SharePoint tenant workbench from a clean machine.

This is an onboarding and handoff document only. It does not describe deployment or package release steps.

## Required URLs

- Tenant workbench base URL:
  `https://hepartsint.sharepoint.com/teams/MSUSEngineering/_layouts/15/workbench.aspx`
- Tenant workbench debug URL:
  `https://hepartsint.sharepoint.com/teams/MSUSEngineering/_layouts/15/workbench.aspx?debug=true&noredir=true&debugManifestsFile=https%3A%2F%2Flocalhost%3A4321%2Ftemp%2Fmanifests.js`
- Expected localhost manifest URL while serving:
  `https://localhost:4321/temp/manifests.js`

## What A New User Must Have

- Access to the Microsoft 365 tenant:
  `[ENTER TENANT NAME OR URL IF DIFFERENT]`
- Access to the SharePoint site:
  `https://hepartsint.sharepoint.com/teams/MSUSEngineering`
- Permission to open the tenant workbench on that site
- Permission to the SharePoint list:
  `Acroset Log`
- Permission to the SharePoint CSV upload folders:
  `/teams/MSUSEngineering/Acroset Data/Results`
  `/teams/MSUSEngineering/Acroset Data/Measurements`
- Node.js `18.x`
- npm
- Local permission to trust the SPFx development certificate on the machine

## First-Time Machine Setup

1. Open a terminal in the SPFx project folder.

   ```bash
   cd /Users/kaelangroves/DEV/acroset-form/spfx
   ```

2. Verify that Node.js is version `18.x`.

   ```bash
   node -v
   ```

3. Install project dependencies.

   ```bash
   npm install
   ```

4. Trust the SPFx localhost development certificate.

   ```bash
   gulp trust-dev-cert
   ```

5. If certificate trust fails or the machine previously trusted an invalid certificate, reset it.

   ```bash
   gulp untrust-dev-cert
   gulp trust-dev-cert
   ```

## Running The App In Tenant Workbench

1. Start the SPFx local server.

   ```bash
   gulp serve
   ```

2. Keep the terminal open.

3. Open the tenant workbench debug URL in the browser.

   ```text
   https://hepartsint.sharepoint.com/teams/MSUSEngineering/_layouts/15/workbench.aspx?debug=true&noredir=true&debugManifestsFile=https%3A%2F%2Flocalhost%3A4321%2Ftemp%2Fmanifests.js
   ```

4. Add the `AcrosetForm` web part from the SharePoint toolbox if needed.

## Validation Checklist

Use this checklist when onboarding a new user:

- `node -v` returns `v18.x.x`
- `npm install` completes successfully
- `gulp trust-dev-cert` completes successfully
- `gulp serve` starts without a localhost certificate error
- `https://localhost:4321/temp/manifests.js` loads in the browser
- The tenant workbench opens successfully
- The `AcrosetForm` web part appears in the toolbox

## Common Failure Points

- The user opens the tenant workbench base URL instead of the full debug URL
- The local development certificate is not trusted
- The browser still rejects `https://localhost:4321`
- The user is on Node `20.x` instead of Node `18.x`
- The user lacks permission to the SharePoint site, list, or folders

## Operational Unknowns To Fill In

Complete these values to make the handoff complete:

- App catalog URL:
  `[ENTER VALUE]`
- Deployment owner:
  `[ENTER VALUE]`
- Support owner:
  `[ENTER VALUE]`
- Expected SharePoint list columns:
  `[ENTER VALUE]`
- Required document library name:
  `[ENTER VALUE]`
- Security groups required for access:
  `[ENTER VALUE]`
- Escalation path if SharePoint permissions fail:
  `[ENTER VALUE]`

## Notes For Future Handoff

- This app must be tested in tenant workbench because it depends on SharePoint resources.
- Successful page load does not guarantee successful save behavior.
- Save behavior also depends on the target list, folder paths, and user permissions remaining valid.
