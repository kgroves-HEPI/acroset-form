// pnpjsConfig.ts
import { WebPartContext } from "@microsoft/sp-webpart-base";
import { spfi, SPFI, SPFx } from "@pnp/sp"; // ← fix: import SPFx from @pnp/sp

import "@pnp/sp/webs";
import "@pnp/sp/lists";
import "@pnp/sp/items";

let _sp: SPFI | undefined;

export const initSP = (context: WebPartContext): SPFI => {
  _sp = spfi().using(SPFx(context));
  return _sp;
};

export const getSP = (): SPFI => {
  if (!_sp) throw new Error("PnPjs not initialized. Call initSP(context) in onInit().");
  return _sp;
};
