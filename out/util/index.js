"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.changeAccountState = exports.convertBalanceByType = exports.postMessage = exports.privateKeyToAddress = exports.makeGenesisState = void 0;
const ethers = require("ethers");
const util_1 = require("@ethereumjs/util");
const config_1 = require("./config");
const makeGenesisState = (accounts) => {
    const convertedAccounts = accounts.map((account) => {
        return {
            [(0, exports.privateKeyToAddress)(account.privateKey).toString()]: [
                (0, util_1.bigIntToHex)(account.balance),
                "0x",
                [],
                "0x00",
            ],
        };
    });
    return Object.assign({}, ...convertedAccounts);
};
exports.makeGenesisState = makeGenesisState;
const privateKeyToAddress = (privateKey) => {
    const address = util_1.Address.fromPrivateKey((0, util_1.hexToBytes)(privateKey));
    return address;
};
exports.privateKeyToAddress = privateKeyToAddress;
const postMessage = (webview, type, payload) => {
    webview.postMessage({
        type,
        payload,
    });
};
exports.postMessage = postMessage;
const convertBalanceByType = (amount, type) => {
    switch (type) {
        case "eth": {
            return ethers.utils.parseEther(amount)._hex;
        }
        case "gwei": {
            return ethers.utils.parseUnits(amount, "gwei")._hex;
        }
        case "wei": {
            return ethers.utils.parseUnits(amount, "wei")._hex;
        }
    }
    return "0x0";
};
exports.convertBalanceByType = convertBalanceByType;
const changeAccountState = async (node) => {
    const accounts = await Promise.all(config_1.DEFAULT_ACCOUNTS.map(async (account) => {
        return {
            address: account.address,
            privateKey: account.privateKey,
            balance: (await node.getBalance(account.address)).toString(),
        };
    }));
    return accounts;
};
exports.changeAccountState = changeAccountState;
//# sourceMappingURL=index.js.map