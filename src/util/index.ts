import * as ethers from "ethers";
import * as vscode from "vscode";

import { ABI } from "../type";
import { Address, bigIntToHex, hexToBytes } from "@ethereumjs/util";
import { DEFAULT_ACCOUNTS } from "./config";
import AntiBlockNode from "../blockchain/node";

export const makeGenesisState = (accounts: any) => {
  const convertedAccounts = accounts.map((account: any) => {
    return {
      [privateKeyToAddress(account.privateKey).toString()]: [
        bigIntToHex(account.balance),
        "0x",
        [],
        "0x00",
      ],
    };
  });

  return Object.assign({}, ...convertedAccounts);
};

export const privateKeyToAddress = (privateKey: string) => {
  const address = Address.fromPrivateKey(hexToBytes(privateKey));
  return address;
};

export const postMessage = (
  webview: vscode.Webview,
  type: string,
  payload: any
) => {
  webview.postMessage({
    type,
    payload,
  });
};

export const convertBalanceByType = (amount: string, type: string) => {
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

export const changeAccountState = async (node:AntiBlockNode) => {
  const accounts = await Promise.all(
    DEFAULT_ACCOUNTS.map(async (account) => {
      return {
        address: account.address,
        privateKey: account.privateKey,
        balance: (await node.getBalance(account.address)).toString(),
      };
    })
  );

  return accounts;
};
