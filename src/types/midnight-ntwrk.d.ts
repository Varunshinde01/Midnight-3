/**
 * Official Midnight Network SDK Type Declarations
 */

declare module '@midnight-ntwrk/midnight-js-types' {
  export enum NetworkId {
    Mainnet = 'mainnet',
    Preprod = 'preprod',
    Devnet = 'devnet',
    Undeployed = 'undeployed',
  }

  export interface ContractAddress {
    value: string;
  }

  export interface TransactionHash {
    value: string;
  }
}

declare module '@midnight-ntwrk/dapp-connector-api' {
  import { NetworkId } from '@midnight-ntwrk/midnight-js-types';

  export interface DAppConnectorState {
    address: string;
    coinPublicKey: string;
    balance: {
      tDUST: bigint;
    };
    networkId: NetworkId;
  }

  export interface DAppConnectorAPI {
    apiVersion: string;
    name: string;
    icon: string;
    enable: () => Promise<{
      state: () => Promise<DAppConnectorState>;
      submitTx: (txHex: string) => Promise<string>;
      signTx: (txData: string) => Promise<string>;
    }>;
    isEnabled: () => Promise<boolean>;
  }
}

declare module '@midnight-ntwrk/compact-runtime' {
  export interface CircuitProof {
    zkirHash: string;
    proof: string;
  }
}

declare module '@midnight-ntwrk/ledger' {
  export interface LedgerState {
    blockHeight: number;
    timestamp: number;
  }
}
