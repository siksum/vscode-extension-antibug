import * as vscode from "vscode";
import * as ejs from "ejs";
import * as fs from "fs";

export default class WebviewPanelProvider {
  public panel: vscode.WebviewPanel;
  public extensionUri: vscode.Uri;
  public viewType: string;

  constructor({
    extensionUri,
    viewType,
    title,
    column = vscode.ViewColumn.Beside,
  }: {
    extensionUri: vscode.Uri;
    viewType: string;
    title: string;
    column: vscode.ViewColumn;
  }) {
    this.viewType = viewType;
    this.extensionUri = extensionUri;
    this.panel = vscode.window.createWebviewPanel(
      "antiblock.function-interaction",
      title,
      column,
      {
        enableScripts: true,
        localResourceRoots: [extensionUri],
      }
    );
  }

  public onDidReceiveMessage(callback: (data: any) => void) {
    this.panel.webview.onDidReceiveMessage(callback);
  }

  public getHtmlForWebview(
    webview: vscode.Webview,
    htmlPath: string,
    controller: vscode.Uri,
    style: vscode.Uri,
    options?: string[]
  ) {
    const ejsData = {
      common: {
        reset: this.getPath(webview, "style", "common", "reset.css"),
        global: this.getPath(webview, "style", "common", "global.css"),
      },
      controller,
      style,
      cspSource: webview.cspSource,
      nonce: this.getNonce(),
    };

    const ejsOption = {
      views: [
        this.getPath(webview, "template", "common").fsPath,
        ...(options ?? []),
      ],
    };

    const html = fs.readFileSync(htmlPath, "utf-8");
    return ejs.render(html, ejsData, ejsOption);
  }

  protected getNonce() {
    let text = "";
    const possible =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  protected getPath(webview: vscode.Webview, ...path: string[]) {
    return webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "src", ...path)
    );
  }
}
