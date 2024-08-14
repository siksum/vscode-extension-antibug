"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chain_1 = require("./chain");
const common_1 = require("@ethereumjs/common");
const vm_1 = require("@ethereumjs/vm");
const util_1 = require("../util");
const block_1 = require("@ethereumjs/block");
const util_2 = require("@ethereumjs/util");
const tx_1 = require("@ethereumjs/tx");
const config_1 = require("../util/config");
// TODO: chain, eip, fork version 설정을 추후 다뤄야함
// 현재는 Mainnet, Shanghai로 고정
class AntiBlockNode {
    static async create() {
        const genesisHeader = {
            timestamp: "0x0",
            gasLimit: 300000000,
            difficulty: 0,
            nonce: "0x0000000000000000",
            extraData: "0x",
        };
        const common = common_1.Common.custom({
            chainId: common_1.Chain.Mainnet,
            networkId: common_1.Chain.Mainnet,
            genesis: genesisHeader,
        }, {
            hardfork: common_1.Hardfork.Shanghai,
            eips: [1559, 4895],
        });
        const genesisBlock = block_1.Block.fromBlockData({ header: genesisHeader }, { common });
        const vm = await vm_1.VM.create({
            common,
            activatePrecompiles: true,
            genesisState: (0, util_1.makeGenesisState)(config_1.DEFAULT_ACCOUNTS),
        });
        const blockchain = new chain_1.default({ genesisBlock });
        return new AntiBlockNode({ common, vm, blockchain });
    }
    constructor({ common, vm, blockchain, }) {
        this.common = common;
        this.vm = vm;
        this.blockchain = blockchain;
    }
    async getBalance(hexAddress) {
        // wallet address to Address
        const address = new util_2.Address((0, util_2.hexToBytes)(hexAddress));
        const stateAccount = await this.vm.stateManager.getAccount(address);
        return stateAccount?.balance ?? 0n;
    }
    async mine(tx) {
        const latestBlock = this.blockchain.getLatestBlock();
        const mineBlock = block_1.Block.fromBlockData({
            header: {
                timestamp: latestBlock.header.timestamp + 1n,
                number: latestBlock.header.number + 1n,
                gasLimit: this.getEstimatedGasLimit(latestBlock),
            },
        }, {
            common: this.common,
        });
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
        this.blockchain.putReceipt((0, util_2.bytesToHex)(tx.hash()), receipt);
        this.blockchain.putBlock(block);
        return {
            block,
            receipt,
        };
    }
    async runTx({ tx, block, }) {
        return await this.vm.runTx({
            tx,
            block,
        });
    }
    async getNonce(privateKey) {
        const address = (0, util_1.privateKeyToAddress)(privateKey);
        const stateAccount = await this.vm.stateManager.getAccount(address);
        return stateAccount?.nonce ?? 0n;
    }
    getEstimatedGasLimit(parentBlock) {
        const parentGasLimit = parentBlock.header.gasLimit;
        const a = parentGasLimit /
            this.common.paramByHardfork("gasConfig", "gasLimitBoundDivisor", "london");
        const maxGasLimit = parentGasLimit + a;
        const minGasLimit = parentGasLimit - a;
        return minGasLimit + (maxGasLimit - minGasLimit) / 2n;
    }
    getLatestBlock() {
        return this.blockchain.getLatestBlock();
    }
    async makeFeeMarketEIP1559Transaction({ value, privateKey, to, callData, }) {
        const latestBlock = this.getLatestBlock();
        const nonce = await this.getNonce(privateKey);
        const gasLimit = this.getEstimatedGasLimit(latestBlock);
        const baseFee = latestBlock.header.calcNextBaseFee();
        const txData = {
            gasLimit: (0, util_2.bigIntToHex)(BigInt(gasLimit)),
            value,
            maxFeePerGas: baseFee,
            nonce,
            to,
            data: callData,
        };
        return tx_1.FeeMarketEIP1559Transaction.fromTxData(txData).sign((0, util_2.hexToBytes)(privateKey));
    }
}
exports.default = AntiBlockNode;
//# sourceMappingURL=node.js.map