/**
 * File Name: pnpjsClient.ts
 * Project: Acroset
 * Description: Shared SharePoint PnPjs client initialization and access helpers for the SPFx app.
 * Author: Kaelan Groves
 * Version: 1.0.0
 * Created Date: 2026-04-23
 * Modified Date: 2026-04-23
 * Copyright: 2025. HEPI.
 * License: Proprietary.
 */

import { WebPartContext } from "@microsoft/sp-webpart-base";
import { spfi, SPFI, SPFx } from "@pnp/sp";

import "@pnp/sp/webs";
import "@pnp/sp/lists";
import "@pnp/sp/items";
import "@pnp/sp/files";
import "@pnp/sp/folders";

let _sp: SPFI | undefined;

/**
 * Creates the shared PnPjs client for this web part instance.
 *
 * The rest of the app calls `getSP()` instead of creating its own client so all
 * SharePoint reads and writes use the same initialized context.
 */
export const initSP = (context: WebPartContext): SPFI => {
  _sp = spfi().using(SPFx(context));
  console.log("[PnPjs] initSP for", context.pageContext.web.absoluteUrl);
  return _sp;
};

/**
 * Returns the initialized PnPjs client.
 *
 * This guard makes failures obvious during development if `initSP()` was not
 * called first by the SPFx web part host.
 */
export const getSP = (): SPFI => {
  if (!_sp) {
    throw new Error("PnPjs not initialized. Call initSP(context) in onInit().");
  }
  return _sp;
};
