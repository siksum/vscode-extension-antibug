"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const webview_1 = require("./webview");
const contract_interaction_1 = require("./contract-interaction");
const child_process_1 = require("child_process");
const config_1 = require("../util/config");
const uuid_1 = require("uuid");
const utils_1 = require("ethers/lib/utils");
const util_1 = require("../util");
class CompileAndInteractionViewProvider extends webview_1.default {
    constructor({ extensionUri, viewType, antibugNode, }) {
        super({
            extensionUri,
            viewType,
        });
        this.node = antibugNode;
    }
    resolveWebviewView(webviewView, context, token) {
        this.view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri],
        };
        const htmlPath = this.getPath(webviewView.webview, "template", "compile-and-interaction", "index.ejs").fsPath;
        const style = this.getPath(webviewView.webview, "style", "compile-and-interaction", "index.css");
        const controller = this.getPath(webviewView.webview, "controller", "compile-and-interaction", "index.js");
        const options = [
            this.getPath(webviewView.webview, "template", "compile-and-interaction")
                .fsPath,
        ];
        webviewView.webview.html = this.getHtmlForWebview(webviewView.webview, htmlPath, controller, style, options);
        webviewView.webview.onDidReceiveMessage(async (data) => {
            const { type, payload } = data;
            switch (type) {
                case "init": {
                    const workspaceFolders = vscode.workspace.workspaceFolders;
                    const solFiles = [];
                    if (workspaceFolders) {
                        for (const folder of workspaceFolders) {
                            const files = await vscode.workspace.findFiles(new vscode.RelativePattern(folder, "**/*.sol"), "**/node_modules/**");
                            solFiles.push(...files);
                        }
                    }
                    const accounts = config_1.DEFAULT_ACCOUNTS.map((account) => ({
                        address: account.address,
                        privateKey: account.privateKey,
                        balance: account.balance.toString(),
                    }));
                    (0, util_1.postMessage)(webviewView.webview, "init", {
                        accounts,
                        solFiles,
                    });
                    this.state = {
                        ...this.state,
                        account: {
                            address: config_1.DEFAULT_ACCOUNTS[0].address,
                            balance: config_1.DEFAULT_ACCOUNTS[0].balance.toString(),
                            privateKey: config_1.DEFAULT_ACCOUNTS[0].privateKey,
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
                    if (this.contractPanel)
                        this.contractPanel.setState({ account });
                    break;
                }
                case "changeValue": {
                    const { value } = payload;
                    this.state = {
                        ...this.state,
                        value,
                    };
                    if (this.contractPanel)
                        this.contractPanel.setState({ value });
                    break;
                }
                case "compile": {
                    const { path } = payload;
                    const compileFilePath = await this.generateTempFileToCompile(path);
                    const stdout = await this.compile(compileFilePath);
                    if (stdout.status === "error") {
                        (0, util_1.postMessage)(webviewView.webview, "compileResult", {
                            contracts: null,
                        });
                        break;
                    }
                    const jsonFile = this.getJsonFileFromStdout(stdout.message, compileFilePath);
                    const contracts = Object.entries(jsonFile).reduce((acc, [contractName, contract]) => {
                        const { abis, bytecodes } = contract;
                        acc[contractName] = {
                            abis,
                            bytecodes,
                        };
                        return acc;
                    }, {});
                    (0, util_1.postMessage)(webviewView.webview, "compileResult", {
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
                    const iface = new utils_1.Interface(abis);
                    const data = args.length > 0 ? iface.encodeDeploy(args).slice(2) : "";
                    const callData = bytecodes.concat(data);
                    const tx = await this.node.makeFeeMarketEIP1559Transaction({
                        to: undefined,
                        value: (0, util_1.convertBalanceByType)(this.state.value.amount, value.type),
                        privateKey,
                        callData,
                    });
                    const { receipt } = await this.node.mine(tx);
                    const accounts = await (0, util_1.changeAccountState)(this.node);
                    (0, util_1.postMessage)(webviewView.webview, "changeAccountState", {
                        accounts,
                    });
                    (0, util_1.postMessage)(webviewView.webview, "changeValue", {
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
                        this.contractPanel = new contract_interaction_1.default({
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
    async generateTempFileToCompile(filePath) {
        const fileData = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
        const fileContent = Buffer.from(fileData).toString();
        const compiledFilePath = path.join(path.dirname(filePath), `${(0, uuid_1.v4)()}-compiled-${path.basename(filePath)}`);
        fs.writeFileSync(compiledFilePath, fileContent);
        return compiledFilePath;
    }
    getJsonFileFromStdout(stdout, fileName) {
        const directoryPath = stdout.split(":")[1].trim();
        const jsonFileName = fileName
            .split("/")
            .pop()
            ?.split(".")[0]
            .concat(".json");
        if (!jsonFileName) {
            throw new Error("Invalid file name");
        }
        const jsonFilePath = path.join(directoryPath, "compile_json_results", jsonFileName);
        return require(jsonFilePath);
    }
    async compile(filePath) {
        return new Promise((resolve, reject) => {
            (0, child_process_1.exec)(`antibug compile ${filePath}`, (error, stdout, stderr) => {
                if (error) {
                    console.error(`exec error: ${error}`);
                    vscode.window
                        .showInformationMessage(error.message, "확인", "취소")
                        .then((value) => {
                        if (value === "확인") {
                            vscode.commands.executeCommand("workbench.action.problems.focus");
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
exports.default = CompileAndInteractionViewProvider;
//# sourceMappingURL=compile-and-interaction.js.map