<!--
File Name: sharepoint-dependencies.md
Project: Acroset
Description: SharePoint tenant, list, and library dependencies required by the Acroset SPFx app.
Author: Kaelan Groves
Version: 1.0.0
Created Date: 2026-04-23
Modified Date: 2026-04-23
Copyright: 2025. HEPI.
License: Proprietary.
-->

# SharePoint Dependencies

## Required Site

- Site URL:
  `https://hepartsint.sharepoint.com/teams/MSUSEngineering`
- Tenant workbench:
  `https://hepartsint.sharepoint.com/teams/MSUSEngineering/_layouts/15/workbench.aspx`

## Required SharePoint Assets

- List title:
  `Acroset Log`
- Results folder:
  `/teams/MSUSEngineering/Acroset Data/Results`
- Measurements folder:
  `/teams/MSUSEngineering/Acroset Data/Measurements`

## Notes

- If the list name changes, update the property pane value or default list title.
- If folder paths change, update `src/features/acrosetForm/config/runtimeConfig.ts`.
- If the tenant workbench URL changes, update `config/serve.json` and `docs/handoff.md`.
