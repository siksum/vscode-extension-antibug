import AntiBlockChain from "./chain";

import { Chain, Hardfork, Common } from "@ethereumjs/common";
import { RunTxResult, VM } from "@ethereumjs/vm";
import { makeGenesisState, privateKeyToAddress } from "../util";
import { Block } from "@ethereumjs/block";
import { Address, bigIntToHex, bytesToHex, hexToBytes } from "@ethereumjs/util";
import {
  BlobEIP4844Transaction,
  FeeMarketEIP1559Transaction,
  LegacyTransaction,
} from "@ethereumjs/tx";
import { DEFAULT_ACCOUNTS } from "../util/config";

// TODO: chain, eip, fork version 설정을 추후 다뤄야함
// 현재는 Mainnet, Shanghai로 고정
export default class AntiBlockNode {
  public common: Common;
  public blockchain: AntiBlockChain;
  public vm: VM;

  static async create() {
    const genesisHeader = {
      timestamp: "0x0",
      gasLimit: 300000000,
      difficulty: 0,
      nonce: "0x0000000000000000",
      extraData: "0x",
    };

    const common = Common.custom(
      {
        chainId: Chain.Mainnet,
        networkId: Chain.Mainnet,
        genesis: genesisHeader,
      },
      {
        hardfork: Hardfork.Shanghai,
        eips: [1559, 4895],
      }
    );

    const genesisBlock = Block.fromBlockData({ header: genesisHeader }, { common });

    const vm = await VM.create({
      common,
      activatePrecompiles: true,
      genesisState: makeGenesisState(DEFAULT_ACCOUNTS),
    });

    const blockchain = new AntiBlockChain({ genesisBlock });

    return new AntiBlockNode({ common, vm, blockchain });
  }

  constructor({
    common,
    vm,
    blockchain,
  }: {
    common: Common;
    vm: VM;
    blockchain: AntiBlockChain;
  }) {
    this.common = common;
    this.vm = vm;
    this.blockchain = blockchain;
  }

  public async getBalance(hexAddress: string): Promise<bigint> {
    // wallet address to Address
    const address = new Address(hexToBytes(hexAddress));
    const stateAccount = await this.vm.stateManager.getAccount(address);
    return stateAccount?.balance ?? 0n;
  }

  public async mine(
    tx: FeeMarketEIP1559Transaction | LegacyTransaction | BlobEIP4844Transaction
  ): Promise<{ block: Block; receipt: RunTxResult }> {
    const latestBlock = this.blockchain.getLatestBlock();
    const mineBlock = Block.fromBlockData(
      {
        header: {
          timestamp: latestBlock.header.timestamp + 1n,
          number: latestBlock.header.number + 1n,
          gasLimit: this.getEstimatedGasLimit(latestBlock),
        },
      },
      {
        common: this.common,
      }
    );

    const buildBlock = await this.vm.buildBlock({
      parentBlock: latestBlock,
      headerData: mineBlock.header,
      blockOpts: {
        freeze: false,
        putBlockIntoBlockchain: true,
      },
    });

    const receipt = await buildBlock.addTransaction(tx);
    const block = await buildBlock.build();

    this.blockchain.putReceipt(bytesToHex(tx.hash()), receipt);
    this.blockchain.putBlock(block);

    return {
      block,
      receipt,
    };
  }

  public async runTx({
    tx,
    block,
  }: {
    tx:
      | FeeMarketEIP1559Transaction
      | LegacyTransaction
      | BlobEIP4844Transaction;
    block?: Block;
  }): Promise<RunTxResult> {
    return await this.vm.runTx({
      tx,
      block,
    });
  }

  public async getNonce(privateKey: string): Promise<bigint> {
    const address = privateKeyToAddress(privateKey);
    const stateAccount = await this.vm.stateManager.getAccount(address);
    return stateAccount?.nonce ?? 0n;
  }

  public getEstimatedGasLimit(parentBlock: Block): bigint {
    const parentGasLimit = parentBlock.header.gasLimit;
    const a =
      parentGasLimit /
      this.common.paramByHardfork(
        "gasConfig",
        "gasLimitBoundDivisor",
        "london"
      );
    const maxGasLimit = parentGasLimit + a;
    const minGasLimit = parentGasLimit - a;

    return minGasLimit + (maxGasLimit - minGasLimit) / 2n;
  }

  public getLatestBlock(): Block {
    return this.blockchain.getLatestBlock();
  }

  public async makeFeeMarketEIP1559Transaction({
    value,
    privateKey,
    to,
    callData,
  }: {
    value: string;
    privateKey: string;
    to?: string;
    callData: string;
  }): Promise<FeeMarketEIP1559Transaction> {
    const latestBlock = this.getLatestBlock();
    const nonce = await this.getNonce(privateKey);
    const gasLimit = this.getEstimatedGasLimit(latestBlock);
    const baseFee = latestBlock.header.calcNextBaseFee();

    const txData = {
      gasLimit: bigIntToHex(BigInt(gasLimit)),
      value,
      maxFeePerGas: baseFee,
      nonce,
      to,
      data: callData,
    };

    return FeeMarketEIP1559Transaction.fromTxData(txData).sign(
      hexToBytes(privateKey)
    );
  }
}
