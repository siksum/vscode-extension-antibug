"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const compile_and_interaction_1 = require("./provider/compile-and-interaction");
const security_analysis_1 = require("./provider/security-analysis");
const node_1 = require("./blockchain/node");
async function activate(context) {
    const antibugNode = await node_1.default.create();
    const compileAndInteractionView = new compile_and_interaction_1.default({
        extensionUri: context.extensionUri,
        viewType: "antiblock.compile-and-interaction",
        antibugNode,
    });
    const securityAnalysisView = new security_analysis_1.default({
        extensionUri: context.extensionUri,
        viewType: "antiblock.security-analysis",
    });
    // information message
    context.subscriptions.push(vscode.window.registerWebviewViewProvider("antiblock.compile-and-interaction", compileAndInteractionView), vscode.window.registerWebviewViewProvider("antiblock.security-analysis", securityAnalysisView));
}
exports.activate = activate;
// 정수가 들어와야하잖아
// This method is called when your extension is deactivated
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map