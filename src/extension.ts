import * as vscode from "vscode";
import CompileAndInteractionViewProvider from "./provider/compile-and-interaction";
import SecurityAnalysisViewProvider from "./provider/security-analysis";
import AntiBlockNode from "./blockchain/node";

export async function activate(context: vscode.ExtensionContext) {
  const antibugNode = await AntiBlockNode.create();
  const compileAndInteractionView = new CompileAndInteractionViewProvider({
    extensionUri: context.extensionUri,
    viewType: "antiblock.compile-and-interaction",
    antibugNode,
  });

  const securityAnalysisView = new SecurityAnalysisViewProvider({
    extensionUri: context.extensionUri,
    viewType: "antiblock.security-analysis",
  });
  // information message

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "antiblock.compile-and-interaction",
      compileAndInteractionView
    ),
    vscode.window.registerWebviewViewProvider(
      "antiblock.security-analysis",
      securityAnalysisView
    )
  );
}

// 정수가 들어와야하잖아

// This method is called when your extension is deactivated
export function deactivate() {}
