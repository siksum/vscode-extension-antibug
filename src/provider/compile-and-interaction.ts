import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

import WebviewProvider from "./webview";
import AntiBlockNode from "../blockchain/node";
import ContractInteractionWebviewPanelProvider from "./contract-interaction";

import { exec } from "child_process";
import { DEFAULT_ACCOUNTS } from "../util/config";
import { v4 as uuidv4 } from "uuid";
import { Interface } from "ethers/lib/utils";
import { changeAccountState, convertBalanceByType, postMessage } from "../util";

type State = {
  account: {
    address: string;
    balance: string;
    privateKey: string;
  };
  contract: {
    name: string;
    bytecodes: string;
    address: string;
    abis: string;
    balance: string;
  };
  value: {
    amount: string;
    type: string;
  };
};

export default class CompileAndInteractionViewProvider extends WebviewProvider {
  private node!: AntiBlockNode;
  private state!: State;
  private contractPanel!: ContractInteractionWebviewPanelProvider;
  constructor({
    extensionUri,
    viewType,
    antibugNode,
  }: {
    extensionUri: vscode.Uri;
    viewType: string;
    antibugNode: AntiBlockNode;
  }) {
    super({
      extensionUri,
      viewType,
    });
    this.node = antibugNode;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext<State>,
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
      "compile-and-interaction",
      "index.ejs"
    ).fsPath;
    const style = this.getPath(
      webviewView.webview,
      "style",
      "compile-and-interaction",
      "index.css"
    );
    const controller = this.getPath(
      webviewView.webview,
      "controller",
      "compile-and-interaction",
      "index.js"
    );

    const options = [
      this.getPath(webviewView.webview, "template", "compile-and-interaction")
        .fsPath,
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

          const accounts = DEFAULT_ACCOUNTS.map((account) => ({
            address: account.address,
            privateKey: account.privateKey,
            balance: account.balance.toString(),
          }));

          postMessage(webviewView.webview, "init", {
            accounts,
            solFiles,
          });

          this.state = {
            ...this.state,
            account: {
              address: DEFAULT_ACCOUNTS[0].address,
              balance: DEFAULT_ACCOUNTS[0].balance.toString(),
              privateKey: DEFAULT_ACCOUNTS[0].privateKey,
            },
            value: {
              amount: "0",
              type: "eth",
            },
          };
          break;
        }
        case "openFile": {
          const { path } = payload;
          const file = await vscode.workspace.openTextDocument(path);

          await vscode.window.showTextDocument(file, {
            preview: false,
            viewColumn: vscode.ViewColumn.One,
          });

          break;
        }
        case "changeAccount": {
          const { account } = payload;
          this.state = {
            ...this.state,
            account,
          };
          if (this.contractPanel) this.contractPanel.setState({ account });
          break;
        }
        case "changeValue": {
          const { value } = payload;

          this.state = {
            ...this.state,
            value,
          };
          if (this.contractPanel) this.contractPanel.setState({ value });
          break;
        }

        case "compile": {
          const { path } = payload;

          const compileFilePath = await this.generateTempFileToCompile(path);

          const stdout = await this.compile(compileFilePath);

          if (stdout.status === "error") {
            postMessage(webviewView.webview, "compileResult", {
              contracts: null,
            });
            break;
          }

          const jsonFile = this.getJsonFileFromStdout(
            stdout.message,
            compileFilePath
          );

          const contracts = Object.entries(jsonFile).reduce(
            (acc: any, [contractName, contract]: any) => {
              const { abis, bytecodes } = contract;

              acc[contractName] = {
                abis,
                bytecodes,
              };

              return acc;
            },
            {}
          );

          postMessage(webviewView.webview, "compileResult", {
            contracts,
          });

          break;
        }
        case "deploy": {
          console.log(this.state);
          const { contract, args } = payload;

          const { abis, bytecodes } = contract;
          const { value, account } = this.state;
          const { privateKey } = account;

          const iface = new Interface(abis);
          const data = args.length > 0 ? iface.encodeDeploy(args).slice(2) : "";
          const callData = bytecodes.concat(data);
          const tx = await this.node.makeFeeMarketEIP1559Transaction({
            to: undefined,
            value: convertBalanceByType(this.state.value.amount, value.type),
            privateKey,
            callData,
          });

          const { receipt } = await this.node.mine(tx);

          const accounts = await changeAccountState(this.node);
          postMessage(webviewView.webview, "changeAccountState", {
            accounts,
          });
          postMessage(webviewView.webview, "changeValue", {
            value: "0",
          });
          this.state = {
            ...this.state,
            value: {
              amount: "0",
              type: "eth",
            },
          };

          if (receipt.createdAddress) {
            const contractAddress = receipt.createdAddress.toString();
            this.contractPanel = new ContractInteractionWebviewPanelProvider({
              extensionUri: this.extensionUri,
              node: this.node,
              primarySidebarWebview: webviewView,
              viewType: "antiblock.contract-interaction",
              title: contract.name,
              column: vscode.ViewColumn.Beside,
            });

            const contractBalance = await this.node.getBalance(contractAddress);
            this.contractPanel.setState({
              account,
              contract: {
                name: contract.name,
                address: contractAddress,
                bytecodes,
                abis,
                balance: contractBalance.toString(),
              },
              value,
            });
            this.contractPanel.render();
          }

          break;
        }
      }
    });
  }

  private async generateTempFileToCompile(filePath: string) {
    const fileData = await vscode.workspace.fs.readFile(
      vscode.Uri.file(filePath)
    );
    const fileContent = Buffer.from(fileData).toString();

    const compiledFilePath = path.join(
      path.dirname(filePath),
      `${uuidv4()}-compiled-${path.basename(filePath)}`
    );
    fs.writeFileSync(compiledFilePath, fileContent);

    return compiledFilePath;
  }

  private getJsonFileFromStdout(stdout: string, fileName: string) {
    const directoryPath = stdout.split(":")[1].trim();
    const jsonFileName = fileName
      .split("/")
      .pop()
      ?.split(".")[0]
      .concat(".json");

    if (!jsonFileName) {
      throw new Error("Invalid file name");
    }

    const jsonFilePath = path.join(
      directoryPath,
      "compile_json_results",
      jsonFileName
    );

    return require(jsonFilePath);
  }

  private async compile(filePath: string): Promise<{
    status: string;
    message: string;
  }> {
    return new Promise((resolve, reject) => {
      exec(`antibug compile ${filePath}`, (error, stdout, stderr) => {
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
          fs.unlinkSync(filePath);

          return resolve({
            status: "error",
            message: error.message,
          });
        }
        if (stderr) {
          console.error(`stderr: ${stderr}`);
          vscode.window.showInformationMessage(stderr);
          fs.unlinkSync(filePath);

          return resolve({
            status: "error",
            message: stderr,
          });
        }
        fs.unlinkSync(filePath);
        return resolve({
          status: "success",
          message: stdout,
        });
      });
    });
  }
}
