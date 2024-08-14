"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const webview_panel_1 = require("./webview-panel");
class AnalysisResultWebviewPanelProvider extends webview_panel_1.default {
    constructor({ extensionUri, viewType, title, column = vscode.ViewColumn.Beside, }) {
        super({
            extensionUri,
            viewType,
            title,
            column,
        });
    }
    render() {
        const htmlPath = this.getPath(this.panel.webview, "template", "analysis-result", "index.ejs").fsPath;
        const style = this.getPath(this.panel.webview, "style", "analysis-result", "index.css");
        const controller = this.getPath(this.panel.webview, "controller", "analysis-result", "index.js");
        const options = [
            this.getPath(this.panel.webview, "template", "analysis-result").fsPath,
        ];
        this.panel.webview.html = this.getHtmlForWebview(this.panel.webview, htmlPath, controller, style, options);
    }
}
exports.default = AnalysisResultWebviewPanelProvider;
//# sourceMappingURL=analysis-result.js.map