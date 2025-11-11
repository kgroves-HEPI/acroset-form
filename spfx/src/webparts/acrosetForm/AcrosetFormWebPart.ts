import * as React from 'react';
import * as ReactDom from 'react-dom';
import { Version } from '@microsoft/sp-core-library';
import {
  type IPropertyPaneConfiguration,
  PropertyPaneTextField
} from '@microsoft/sp-property-pane';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import { initSP } from "../../pnpjsConfig";

//import * as strings from 'AcrosetFormWebPartStrings';
import AcrosetForm from './components/AcrosetForm';



import "@pnp/sp/webs";
import "@pnp/sp/lists";
import "@pnp/sp/items";


export interface IAcrosetFormWebPartProps {
  description: string;
  listTitle?: string;
}

export default class AcrosetFormWebPart extends BaseClientSideWebPart<IAcrosetFormWebPartProps> {

public onInit(): Promise<void> {
    return super.onInit().then(() => {
      initSP(this.context); // <-- THIS must run before React uses getSP()
    });
  }

public render(): void {
  const element = React.createElement(AcrosetForm, {
    listTitle: this.properties.listTitle || "Acroset Log", // ← prop to your React component
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
            PropertyPaneTextField("listTitle", {
              label: "Target SharePoint list title",
              description: "Display name (e.g., Acroset Log)"
            })
              ]
            }
          ]
        }
      ]
    };
  }
}
