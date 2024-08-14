"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class AntiBlockChain {
    constructor({ genesisBlock }) {
        this.blockByNumber = new Map();
        this.receiptByTxHash = new Map();
        this.chain = [genesisBlock];
        this.blockByNumber.set(genesisBlock.header.number, genesisBlock);
    }
    getLatestBlock() {
        return this.chain[this.chain.length - 1];
    }
    getBlockByNumber(number) {
        return this.blockByNumber.get(number);
    }
    getReceiptByTxHash(txHash) {
        return this.receiptByTxHash.get(txHash);
    }
    putBlock(block) {
        this.chain.push(block);
        this.blockByNumber.set(block.header.number, block);
    }
    putReceipt(txHash, receipt) {
        this.receiptByTxHash.set(txHash, receipt);
    }
}
exports.default = AntiBlockChain;
//# sourceMappingURL=chain.js.map