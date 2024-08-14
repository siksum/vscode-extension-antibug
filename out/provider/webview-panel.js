"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const ejs = require("ejs");
const fs = require("fs");
class WebviewPanelProvider {
    constructor({ extensionUri, viewType, title, column = vscode.ViewColumn.Beside, }) {
        this.viewType = viewType;
        this.extensionUri = extensionUri;
        this.panel = vscode.window.createWebviewPanel("antiblock.function-interaction", title, column, {
            enableScripts: true,
            localResourceRoots: [extensionUri],
        });
    }
    onDidReceiveMessage(callback) {
        this.panel.webview.onDidReceiveMessage(callback);
    }
    getHtmlForWebview(webview, htmlPath, controller, style, options) {
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
    getNonce() {
        let text = "";
        const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
    getPath(webview, ...path) {
        return webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "src", ...path));
    }
}
exports.default = WebviewPanelProvider;
//# sourceMappingURL=webview-panel.js.map