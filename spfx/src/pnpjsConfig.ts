import { spfi, SPFI } from "@pnp/sp";
import { SPFx } from "@pnp/sp/presets/all";
import { WebPartContext } from "@microsoft/sp-webpart-base";

let _sp: SPFI | undefined = undefined;

export const getSP = (context?: WebPartContext): SPFI => {
  if (_sp === undefined && context) {
    _sp = spfi().using(SPFx(context));
  }

  if (!_sp) {
    throw new Error("PnPjs not initialized. Call getSP(context) first.");
  }

  return _sp;
};
