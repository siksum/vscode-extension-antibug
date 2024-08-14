export interface ABI {
  inputs: FunctionInput[];
  name: string;
  outputs: any[];
  stateMutability: string;
  type: string;
  signature: string;
}

export interface FunctionInput {
  internalType: string;
  name: string;
  type: string;
}
