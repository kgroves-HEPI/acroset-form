/**
 * File Name: sharePointStorage.ts
 * Project: Acroset
 * Description: SharePoint file upload helpers used by the Acroset submission flow.
 * Author: Kaelan Groves
 * Version: 1.0.0
 * Created Date: 2026-04-23
 * Modified Date: 2026-04-23
 * Copyright: 2025. HEPI.
 * License: Proprietary.
 */

import { getSP } from "../../../platform/sharepoint/pnpjsClient";

export async function uploadCsvToFolder(
  folderServerRelativePath: string,
  fileName: string,
  csvText: string
) {
  const sp = getSP();
  const webAny: any = sp.web as any;

  // Support either PnPjs folder accessor so the helper stays compatible with
  // the API surface available in the current SPFx environment.
  const folder =
    webAny.getFolderByServerRelativePath?.(folderServerRelativePath) ||
    webAny.getFolderByServerRelativeUrl?.(folderServerRelativePath);

  if (!folder) {
    throw new Error(
      "Folder API not available. Ensure '@pnp/sp/folders' is imported."
    );
  }

  const filesAny: any = folder.files;
  // Prefer the newer path-based upload API, but fall back to the older add()
  // signature if that is what the tenant bundle exposes.
  if (filesAny?.addUsingPath) {
    await filesAny.addUsingPath(fileName, csvText, { Overwrite: true });
  } else {
    await filesAny.add(fileName, csvText, true);
  }

  // Read the saved file back so the caller gets a stable URL and metadata to
  // persist on the SharePoint list item.
  const fileReference = `${folderServerRelativePath}/${fileName}`;
  const fileSelector =
    webAny.getFileByServerRelativePath?.(fileReference) ||
    webAny.getFileByServerRelativeUrl?.(fileReference);

  const file = await fileSelector.select(
    "ServerRelativeUrl",
    "LinkingUri",
    "Name",
    "UniqueId"
  )();

  return {
    absUrl:
      file.LinkingUri ?? `${window.location.origin}${file.ServerRelativeUrl}`,
    uniqueId: file.UniqueId as string,
    name: file.Name as string,
  };
}
