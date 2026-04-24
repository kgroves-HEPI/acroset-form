<!--
File Name: handoff.md
Project: Acroset
Description: Handoff checklist, local setup, and ownership notes for the Acroset SPFx app.
Author: Kaelan Groves
Version: 1.0.0
Created Date: 2026-04-23
Modified Date: 2026-04-23
Copyright: 2025. HEPI.
License: Proprietary.
-->

# Handoff

## Local Development Requirements

- Node.js `18.17.1`
- npm
- Trusted SPFx localhost development certificate
- Access to the tenant and SharePoint site
- Permission to the required list and document libraries

## Local Startup

1. Open a terminal in `acroset-form/spfx`.
2. Run `npm install`.
3. Run `gulp trust-dev-cert`.
4. Run `gulp serve`.
5. Open:

```text
https://hepartsint.sharepoint.com/teams/MSUSEngineering/_layouts/15/workbench.aspx?debug=true&noredir=true&debugManifestsFile=https%3A%2F%2Flocalhost%3A4321%2Ftemp%2Fmanifests.js
```

## Handoff Checklist

- The new owner can load `https://localhost:4321/temp/manifests.js` while `gulp serve` is running.
- The new owner knows the required list and folder dependencies.
- The new owner knows the default list title is configurable from the property pane.
- The new owner knows ownership and support contacts.
- The new owner knows tenant-specific paths are defined in `runtimeConfig.ts` and `config/serve.json`.

## Ownership

- Technical owner: `Kaelan Groves / MSUS Engineering`
- Business owner: `Jill Renfroe / IT`
- SharePoint site owner: `Chris Berry / MSUS Engineering`
- List schema owner: `Global Engineering`
- Folder or library owner: `Jill Renfroe / IT`
- Support contacts:
  - `kaelan.groves@hepi.com`
  - `chris.berry@hepi.com`
  - `jill.renfroe@hepi.com`
