"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const webview_panel_1 = require("./webview-panel");
const util_1 = require("../util");
const utils_1 = require("ethers/lib/utils");
const util_2 = require("@ethereumjs/util");
class ContractInteractionWebviewPanelProvider extends webview_panel_1.default {
    constructor({ extensionUri, node, viewType, primarySidebarWebview, title, column = vscode.ViewColumn.Beside, }) {
        super({
            extensionUri,
            viewType,
            title,
            column,
        });
        this.primarySidebarWebview = primarySidebarWebview;
        this.node = node;
    }
    render() {
        const htmlPath = this.getPath(this.panel.webview, "template", "contract-interaction", "index.ejs").fsPath;
        const style = this.getPath(this.panel.webview, "style", "contract-interaction", "index.css");
        const controller = this.getPath(this.panel.webview, "controller", "contract-interaction", "index.js");
        const options = [
            this.getPath(this.panel.webview, "template", "contract-interaction")
                .fsPath,
        ];
        this.panel.webview.html = this.getHtmlForWebview(this.panel.webview, htmlPath, controller, style, options);
        (0, util_1.postMessage)(this.panel.webview, "init", {
            contract: this.state.contract,
        });
        this.onDidReceiveMessage(async (data) => {
            const { type, payload } = data;
            switch (type) {
                case "call": {
                    const { functionName, args } = payload;
                    const contract = this.state.contract;
                    const currentAccount = this.state.account;
                    const iface = new utils_1.Interface(contract.abis);
                    const callData = iface.encodeFunctionData(functionName, args);
                    const tx = await this.node.makeFeeMarketEIP1559Transaction({
                        to: contract.address,
                        value: "0x0",
                        callData,
                        privateKey: currentAccount.privateKey,
                    });
                    try {
                        const receipt = await this.node.runTx({ tx });
                        const { amountSpent, totalSpent, from, to, executedGasUsed, input, output, } = this.parseReceipt(receipt, iface, functionName);
                        const txHash = (0, util_2.bytesToHex)(tx.hash());
                        const balance = (await this.node.getBalance(contract.address)).toString();
                        (0, util_1.postMessage)(this.panel.webview, "changeContractBalance", {
                            balance,
                        });
                        // how to show data bottom panel
                        (0, util_1.postMessage)(this.panel.webview, "transactionResult", {
                            txHash,
                            amountSpent,
                            totalSpent,
                            from,
                            to,
                            executedGasUsed,
                            input,
                            output,
                        });
                    }
                    catch (e) {
                        (0, util_1.postMessage)(this.panel.webview, "transactionResult", {
                            txHash: "Error",
                            error: e.message,
                        });
                    }
                    break;
                }
                case "send": {
                    const { functionName, args } = payload;
                    const contract = this.state.contract;
                    const currentAccount = this.state.account;
                    const iface = new utils_1.Interface(contract.abis);
                    const callData = iface.encodeFunctionData(functionName, args);
                    const value = (0, util_1.convertBalanceByType)(this.state.value.amount, this.state.value.type);
                    const tx = await this.node.makeFeeMarketEIP1559Transaction({
                        to: contract.address,
                        value: (0, util_2.bigIntToHex)(BigInt(value)),
                        callData,
                        privateKey: currentAccount.privateKey,
                    });
                    try {
                        const { receipt } = await this.node.mine(tx);
                        const { amountSpent, totalSpent, from, to, executedGasUsed, input, output, } = this.parseReceipt(receipt, iface, functionName);
                        const txHash = (0, util_2.bytesToHex)(tx.hash());
                        const balance = (await this.node.getBalance(contract.address)).toString();
                        (0, util_1.postMessage)(this.panel.webview, "changeContractBalance", {
                            balance,
                        });
                        const accounts = await (0, util_1.changeAccountState)(this.node);
                        (0, util_1.postMessage)(this.primarySidebarWebview.webview, "changeAccountState", {
                            accounts,
                        });
                        const storage = await receipt.execResult.runState?.stateManager?.dumpStorage(util_2.Address.fromString(contract.address));
                        (0, util_1.postMessage)(this.panel.webview, "changeStorage", {
                            storage: JSON.stringify(storage),
                        });
                        (0, util_1.postMessage)(this.primarySidebarWebview.webview, "changeValue", {
                            value: "0",
                        });
                        this.setState({
                            value: {
                                amount: "0",
                                type: "eth",
                            },
                        });
                        (0, util_1.postMessage)(this.panel.webview, "transactionResult", {
                            txHash,
                            amountSpent,
                            totalSpent,
                            from,
                            to,
                            executedGasUsed,
                            input,
                            output,
                        });
                    }
                    catch (e) {
                        (0, util_1.postMessage)(this.panel.webview, "transactionResult", {
                            txHash: "Error",
                            error: e.message,
                        });
                    }
                    break;
                }
            }
        });
    }
    setState(state) {
        console.log(state);
        this.state = {
            ...this.state,
            ...state,
        };
    }
    parseReceipt(receipt, iface, functionName) {
        const amountSpent = receipt.amountSpent.toString();
        const totalSpent = receipt.totalGasSpent.toString();
        const from = receipt.execResult.runState?.env.caller.toString();
        const to = receipt.execResult.runState?.env.address.toString();
        const executedGasUsed = receipt.execResult.executionGasUsed.toString();
        const input = iface
            .decodeFunctionData(functionName, receipt.execResult.runState?.env.callData)
            .map((arg) => arg.toString());
        const output = iface
            .decodeFunctionResult(functionName, receipt.execResult.returnValue)
            .map((arg) => arg.toString());
        return {
            amountSpent,
            totalSpent,
            from,
            to,
            executedGasUsed,
            input,
            output,
        };
    }
}
exports.default = ContractInteractionWebviewPanelProvider;
//# sourceMappingURL=contract-interaction.js.map