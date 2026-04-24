/**
 * File Name: AcrosetFormWebPart.ts
 * Project: Acroset
 * Description: SPFx web part entrypoint that initializes SharePoint services and mounts the Acroset React feature.
 * Author: Kaelan Groves
 * Version: 1.0.0
 * Created Date: 2026-04-23
 * Modified Date: 2026-04-23
 * Copyright: 2025. HEPI.
 * License: Proprietary.
 */

import * as React from 'react';
import * as ReactDom from 'react-dom';
import { Environment, EnvironmentType, Version } from '@microsoft/sp-core-library';
import {
  type IPropertyPaneConfiguration,
  PropertyPaneTextField
} from '@microsoft/sp-property-pane';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import AcrosetForm from '../../features/acrosetForm/AcrosetForm';
import { DEFAULT_LIST_TITLE } from '../../features/acrosetForm/config/runtimeConfig';
import { initSP } from "../../platform/sharepoint/pnpjsClient";

import "@pnp/sp/webs";
import "@pnp/sp/lists";
import "@pnp/sp/items";

export interface IAcrosetFormWebPartProps {
  description: string;
  listTitle?: string;
}

/**
 * SPFx entry point for the Acroset form web part.
 *
 * In simple terms:
 * - SPFx creates this class when the web part is placed on a page.
 * - `onInit()` wires up PnPjs so the React app can talk to SharePoint.
 * - `render()` mounts the React form and passes in the target list title.
 */
export default class AcrosetFormWebPart extends BaseClientSideWebPart<IAcrosetFormWebPartProps> {

  /**
   * Initializes the SharePoint client before any child component tries to use it.
   */
  public onInit(): Promise<void> {
    return super.onInit().then(() => {
      initSP(this.context);
    });
  }

  /**
   * Renders the React app into the DOM element that SPFx gives this web part.
   */
  public render(): void {
    const element = React.createElement(AcrosetForm, {
      // This keeps the SharePoint list configurable without changing code.
      listTitle: this.properties.listTitle || DEFAULT_LIST_TITLE,
      isLocalWorkbench: Environment.type === EnvironmentType.Local,
    });

    ReactDom.render(element, this.domElement);
  }


  protected onDispose(): void {
    ReactDom.unmountComponentAtNode(this.domElement);
  }

  protected get dataVersion(): Version {
    return Version.parse('1.0');
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [{
        header: { description: "Settings" },
        groups: [{
          groupFields: [
            // Reviewers can change the list name here without touching the React code.
            PropertyPaneTextField("listTitle", {
              label: "Target SharePoint list title",
              description: "Display name (e.g., Acroset Log)"
            })
          ]
        }]
      }]
    };
  }
}
