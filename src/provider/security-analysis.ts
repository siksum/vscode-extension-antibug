import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

import WebviewProvider from "./webview";
import AnalysisResultWebviewPanelProvider from "./analysis-result";

import { exec, ChildProcess } from "child_process";

export default class SecurityAnalysisViewProvider extends WebviewProvider {
  private auditReportKR?: string;
  private auditReportEN?: string;

  constructor({
    extensionUri,
    viewType,
  }: {
    extensionUri: vscode.Uri;
    viewType: string;
  }) {
    super({
      extensionUri,
      viewType,
    });
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext<unknown>,
    token: vscode.CancellationToken
  ): void | Thenable<void> {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    const htmlPath = this.getPath(
      webviewView.webview,
      "template",
      "security-analysis",
      "index.ejs"
    ).fsPath;
    const style = this.getPath(
      webviewView.webview,
      "style",
      "security-analysis",
      "index.css"
    );
    const controller = this.getPath(
      webviewView.webview,
      "controller",
      "security-analysis",
      "index.js"
    );

    const options = [
      this.getPath(webviewView.webview, "template", "security-analysis").fsPath,
    ];
    webviewView.webview.html = this.getHtmlForWebview(
      webviewView.webview,
      htmlPath,
      controller,
      style,
      options
    );

    webviewView.webview.onDidReceiveMessage(async (data) => {
      const { type, payload } = data;

      switch (type) {
        case "init": {
          const workspaceFolders = vscode.workspace.workspaceFolders;
          const solFiles: vscode.Uri[] = [];

          if (workspaceFolders) {
            for (const folder of workspaceFolders) {
              const files = await vscode.workspace.findFiles(
                new vscode.RelativePattern(folder, "**/*.sol"),
                "**/node_modules/**"
              );
              solFiles.push(...files);
            }
          }

          this.view?.webview.postMessage({
            type: "init",
            payload: {
              solFiles,
            },
          });
          break;
        }

        case "changeFile": {
          const { path } = payload;
          const file = await vscode.workspace.openTextDocument(path);
          await vscode.window.showTextDocument(file, {
            preview: false,
            viewColumn: vscode.ViewColumn.One,
          });
          break;
        }

        case "analysis": {
          const { selectedLanguages, selectedRules, selectedSolFile } = payload;
          console.log(selectedSolFile, selectedRules, selectedLanguages);

          // const stdout = await this.analysis(language, rule, path);
          // const { message } = stdout;

          // const regex = /Not a directory: '(.*)'/;
          // const match = message.match(regex);

          // if (match) {
          //   const pathValue = match[1];
          //   console.log(pathValue);
          // } else {
          //   console.log("No match found.");
          // }

          // const panelProvider = new SecurityAnalysisWebviewPanelProvider({
          //   extensionUri: this.extensionUri,
          //   viewType: "antiblock.analysis-report",
          //   title: path,
          //   column: vscode.ViewColumn.Beside,
          // });

          // panelProvider.render();
          // panelProvider.panel.webview.postMessage({
          //   type: "printResult",
          //   payload: {
          //     stdout,
          //   },
          // });
          break;
        }

        case "RunAnalysis": {
          const { rules, files } = payload;
          if (files === "Select a file to analyze") {
            vscode.window
              .showInformationMessage(
                "Please select a file to analyze.",
                "확인",
                "취소"
              )
              .then((value) => {
                if (value === "확인") {
                  vscode.commands.executeCommand(
                    "workbench.action.problems.focus"
                  );
                }
              });
            break;
          } else {
            const stdout = await this.analysis(rules, files);

            const result = stdout.message;

            if (result.match(/Detecting specific vulnerabilities/)) {
              const filename = path.basename(files, path.extname(files));
              const OutputDirectoryRegex = /Output Directory: (.+)/;
              const OutputDirectoryMatch = result.match(OutputDirectoryRegex);

              if (OutputDirectoryMatch && OutputDirectoryMatch.length > 1) {
                const outputDirectoryPath = OutputDirectoryMatch[1].trim();

                this.auditReportEN = path.join(
                  outputDirectoryPath,
                  "/audit_report",
                  filename + "_en.md"
                );
                this.auditReportKR = path.join(
                  outputDirectoryPath,
                  "/audit_report",
                  filename + "_kr.md"
                );

                // Path 값 설정
                const contractAnalysisResultPath =
                  outputDirectoryPath +
                  "/contract_analysis_json_results/" +
                  filename +
                  ".json";

                const detectorResultPath =
                  outputDirectoryPath +
                  "/detector_json_results/" +
                  filename +
                  "_kr.json";

                const callGraphResultPath =
                  outputDirectoryPath +
                  "/call_graph_json_results/" +
                  filename +
                  ".json";

                const auditReportPath =
                  outputDirectoryPath +
                  "/call_graph_results/" +
                  "call-graph.png";

                const panelProvider = new AnalysisResultWebviewPanelProvider({
                  extensionUri: this.extensionUri,
                  viewType: "antiblock.analysis-result",
                  title: "Analysis Result (" + filename + ".sol)",
                  column: vscode.ViewColumn.Two,
                });
                panelProvider.render();
                panelProvider.onDidReceiveMessage(async (data) => {
                  const { type, payload } = data;
                  switch (type) {
                    case "init": {
                      panelProvider.panel.webview.postMessage({
                        type: "init",
                        payload: { files },
                      });
                      break;
                    }

                    case "ExtractAuditReport": {
                      const { isKoreanSelected, isEnglishSelected } = payload;
                      if (this.auditReportKR && this.auditReportEN) {
                        await this.ExtractAuditReport(
                          this.auditReportKR,
                          isKoreanSelected
                        );
                        await this.ExtractAuditReport(
                          this.auditReportEN,
                          isEnglishSelected
                        );
                      } else {
                        vscode.window
                          .showInformationMessage("", "확인", "취소")
                          .then((value) => {
                            if (value === "확인") {
                              vscode.commands.executeCommand(
                                "workbench.action.problems.focus"
                              );
                            }
                          });
                      }
                      break;
                    }

                    case "codeLinechecked": {
                      const { files, codeLine, impact } = payload;

                      const lineParts = codeLine.split(" ");
                      const lineNumber = parseInt(
                        lineParts[lineParts.length - 1]
                      );

                      const decorationTypes: {
                        [key: string]: vscode.TextEditorDecorationType;
                      } = {
                        High: vscode.window.createTextEditorDecorationType({
                          backgroundColor: "rgba(239, 102, 102, 0.2)",
                          isWholeLine: true,
                        }),
                        Medium: vscode.window.createTextEditorDecorationType({
                          backgroundColor: "rgba(250, 200, 88, 0.2)",
                          isWholeLine: true,
                        }),
                        Low: vscode.window.createTextEditorDecorationType({
                          backgroundColor: "rgba(146, 204, 118, 0.2)",
                          isWholeLine: true,
                        }),
                        Info: vscode.window.createTextEditorDecorationType({
                          backgroundColor: "rgba(84, 112, 198, 0.2)",
                          isWholeLine: true,
                        }),
                        default: vscode.window.createTextEditorDecorationType({
                          backgroundColor: "rgba(255, 255, 255, 0)",
                          isWholeLine: true,
                        }),
                      };

                      const decorationType =
                        decorationTypes[impact] || decorationTypes.default;

                      const openedDoc = vscode.workspace.textDocuments.find(
                        (doc) => doc.fileName === files
                      );

                      if (openedDoc) {
                        vscode.window
                          .showTextDocument(openedDoc, {
                            viewColumn: vscode.ViewColumn.One,
                            preserveFocus: true,
                            preview: false,
                          })
                          .then((editor) => {
                            const line = lineNumber - 1;
                            const startPos = new vscode.Position(line, 0);
                            const endPos = new vscode.Position(line, 0);
                            const range = new vscode.Range(startPos, endPos);

                            const decoration = { range };
                            const decorations: vscode.DecorationOptions[] = [
                              decoration,
                            ];

                            editor.setDecorations(decorationType, decorations);
                            setTimeout(() => {
                              decorationType.dispose();
                            }, 3000);
                          });
                      } else {
                        vscode.workspace
                          .openTextDocument(files)
                          .then((doc) => {
                            vscode.window
                              .showTextDocument(doc, {
                                viewColumn: vscode.ViewColumn.One,
                                preserveFocus: true,
                                preview: false,
                              })
                              .then((editor) => {
                                const line = lineNumber - 1;
                                const startPos = new vscode.Position(line, 0);
                                const endPos = new vscode.Position(line, 0);
                                const range = new vscode.Range(
                                  startPos,
                                  endPos
                                );

                                const decoration = { range };
                                const decorations: vscode.DecorationOptions[] =
                                  [decoration];

                                editor.setDecorations(
                                  decorationType,
                                  decorations
                                );
                                setTimeout(() => {
                                  decorationType.dispose();
                                }, 3000);
                              });
                          })
                          .then(undefined, (error) => {
                            console.error(error);
                            vscode.window.showErrorMessage(
                              "An error occurred while opening the file."
                            );
                          });
                      }

                      break;
                    }
                  }
                });
              } else {
                vscode.window
                  .showInformationMessage(
                    "Vulnerabilities have not been detected.",
                    "확인",
                    "취소"
                  )
                  .then((value) => {
                    if (value === "확인") {
                      vscode.commands.executeCommand(
                        "workbench.action.problems.focus"
                      );
                    }
                  });
              }
              break;
            }
          }
        }
      }
    });
  }

  private async analysis(
    rule: string,
    filePath: string
  ): Promise<{
    status: string;
    message: string;
  }> {
    return new Promise((resolve, reject) => {
      exec(`antibug detect ${rule} ${filePath}`, (error, stdout, stderr) => {
        if (error) {
          console.error(`exec error: ${error}`);
          vscode.window
            .showInformationMessage(error.message, "확인", "취소")
            .then((value) => {
              if (value === "확인") {
                vscode.commands.executeCommand(
                  "workbench.action.problems.focus"
                );
              }
            });
        }
        if (stderr) {
          console.error(`stderr: ${stderr}`);
          vscode.window.showInformationMessage(stderr);
        }
        return resolve({
          status: "success",
          message: stdout,
        });
      });
    });
  }

  private async ExtractAuditReport(filePath: string, view: boolean) {
    const fileContent = fs.readFileSync(filePath, "utf8");
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (workspaceFolders && workspaceFolders.length > 0) {
      const workspaceRoot = workspaceFolders[0].uri.fsPath;
      const resultDir = path.join(workspaceRoot, "result");

      if (!fs.existsSync(resultDir)) {
        fs.mkdirSync(resultDir);
      }

      const fileNameWithoutExtension = path.basename(
        filePath,
        path.extname(filePath)
      );
      const newFileName = `${fileNameWithoutExtension}.md`;

      const newFilePath = path.join(resultDir, newFileName);

      fs.writeFileSync(newFilePath, fileContent, "utf8");

      if (view) {
        vscode.commands.executeCommand(
          "markdown.showPreviewToSide",
          vscode.Uri.file(newFilePath)
        );
      }
    }
  }
}
