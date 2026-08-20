/**
 * Midnight Smart Contract & Circuit Simulation Engine
 * SealedBidAuction.ts
 *
 * Implements Midnight's dual-state architecture:
 * - Public Ledger State (Disclosed on-chain)
 * - Private Local State (Zero-knowledge witness data held in wallet/client)
 */

export type AuctionState = 'Bidding' | 'Revealed' | 'Settled';

export interface PublicBidCommitment {
  bidderPublicKey: string;
  commitmentHash: string;
  timestamp: number;
  nullifier: string;
}

export interface PrivateBidWitness {
  bidAmount: number;
  salt: string;
  secretKey: string;
}

export interface DisclosedWinner {
  winnerPublicKey: string;
  winningBidAmount: number;
  settlementProof: string;
  settledAt: number;
}

export interface AuctionParams {
  id: string;
  title: string;
  description: string;
  itemImage: string;
  sellerPublicKey: string;
  minBidAmount: number;
  endTime: number;
}

export class SealedBidAuctionContract {
  // Public Ledger State (What observers on the blockchain see)
  public id: string;
  public title: string;
  public description: string;
  public itemImage: string;
  public sellerPublicKey: string;
  public minBidAmount: number;
  public endTime: number;
  public state: AuctionState;
  public commitments: PublicBidCommitment[] = [];
  public winner: DisclosedWinner | null = null;

  // Track spent nullifiers to prevent double-bidding
  private nullifierRegistry: Set<string> = new Set();

  constructor(params: AuctionParams) {
    this.id = params.id;
    this.title = params.title;
    this.description = params.description;
    this.itemImage = params.itemImage;
    this.sellerPublicKey = params.sellerPublicKey;
    this.minBidAmount = params.minBidAmount;
    this.endTime = params.endTime;
    this.state = 'Bidding';
  }

  /**
   * Cryptographic Hash Helper (SHA-256 simulation using Web / Node standard algorithms)
   */
  public static async computeHash(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(data);
    
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } else {
      // Simple fallback hash algorithm for lightweight unit tests if subtle crypto is mocked
      let hash = 0;
      for (let i = 0; i < data.length; i++) {
        const char = data.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0;
      }
      return '0x' + Math.abs(hash).toString(16).padStart(64, '0');
    }
  }

  /**
   * Helper: Generate Commitment Hash from Private Witness
   */
  public static async createCommitmentHash(
    bidAmount: number,
    salt: string,
    bidderPublicKey: string
  ): Promise<string> {
    const raw = `${bidAmount}:${salt}:${bidderPublicKey}`;
    return await SealedBidAuctionContract.computeHash(raw);
  }

  /**
   * Helper: Generate Nullifier Hash
   */
  public static async createNullifier(
    bidderSecretKey: string,
    auctionId: string
  ): Promise<string> {
    const raw = `NULLIFIER:${bidderSecretKey}:${auctionId}`;
    return await SealedBidAuctionContract.computeHash(raw);
  }

  /**
   * Client-side Zero-Knowledge Prover Circuit
   * Executes locally in user's browser/wallet without sending private witness data anywhere.
   */
  public async generateBidProof(
    witness: PrivateBidWitness,
    bidderPublicKey: string
  ): Promise<{
    commitmentHash: string;
    nullifier: string;
    zkProof: string;
    valid: boolean;
    error?: string;
  }> {
    // Constraint 1: Bid must be >= minimum starting bid
    if (witness.bidAmount < this.minBidAmount) {
      return {
        commitmentHash: '',
        nullifier: '',
        zkProof: '',
        valid: false,
        error: `Circuit Constraint Failed: Bid amount ($${witness.bidAmount}) is below minimum ($${this.minBidAmount})`
      };
    }

    // Constraint 2: Generate unique nullifier to prevent double bidding
    const nullifier = await SealedBidAuctionContract.createNullifier(witness.secretKey, this.id);

    // Constraint 3: Generate SHA-256 commitment hash hiding the bid amount & salt
    const commitmentHash = await SealedBidAuctionContract.createCommitmentHash(
      witness.bidAmount,
      witness.salt,
      bidderPublicKey
    );

    // Generate ZK Proof structure (ZK-SNARK mock payload containing circuit state verification)
    const zkProofPayload = `ZK-SNARK-PROOF[Auction:${this.id}|MinThreshold:${this.minBidAmount}|Hash:${commitmentHash.slice(0, 16)}]`;
    const zkProof = await SealedBidAuctionContract.computeHash(zkProofPayload);

    return {
      commitmentHash,
      nullifier,
      zkProof,
      valid: true
    };
  }

  /**
   * Contract On-Chain Method: Submit Sealed Bid
   * Verifies proof and adds commitment hash to public ledger.
   */
  public async submitSealedBid(
    bidderPublicKey: string,
    commitmentHash: string,
    nullifier: string,
    zkProof: string
  ): Promise<{ success: boolean; message: string }> {
    if (this.state !== 'Bidding') {
      return { success: false, message: 'Auction is not currently open for bidding.' };
    }

    // Verify Nullifier (prevent double voting/bidding)
    if (this.nullifierRegistry.has(nullifier)) {
      return { success: false, message: 'Nullifier already spent! Duplicate bid rejected.' };
    }

    // Verify ZK Proof format
    if (!zkProof || zkProof.length === 0) {
      return { success: false, message: 'Invalid or missing Zero-Knowledge proof.' };
    }

    // Record on public ledger
    this.commitments.push({
      bidderPublicKey,
      commitmentHash,
      timestamp: Date.now(),
      nullifier
    });

    this.nullifierRegistry.add(nullifier);

    return {
      success: true,
      message: `Sealed bid commitment ${commitmentHash.slice(0, 10)}... registered on Midnight ledger!`
    };
  }

  /**
   * Contract On-Chain Method: Settle Auction & Selectively Disclose Winner
   * Discloses ONLY the winning bid amount and winner public key. All non-winning bids remain 100% private.
   */
  public async settleAuction(
    disclosedBids: {
      witness: PrivateBidWitness;
      bidderPublicKey: string;
    }[]
  ): Promise<{ success: boolean; winner?: DisclosedWinner; message: string }> {
    if (this.commitments.length === 0) {
      return { success: false, message: 'Cannot settle auction with zero bids.' };
    }

    let highestBid = -1;
    let highestBidderPk = '';
    let validWinningWitness: PrivateBidWitness | null = null;

    // Verify each disclosed winning candidate against on-chain commitment hashes
    for (const entry of disclosedBids) {
      const computedHash = await SealedBidAuctionContract.createCommitmentHash(
        entry.witness.bidAmount,
        entry.witness.salt,
        entry.bidderPublicKey
      );

      // Verify that this bid corresponds to a registered commitment on the ledger
      const commitmentExists = this.commitments.some(
        c => c.commitmentHash === computedHash && c.bidderPublicKey === entry.bidderPublicKey
      );

      if (commitmentExists && entry.witness.bidAmount > highestBid) {
        highestBid = entry.witness.bidAmount;
        highestBidderPk = entry.bidderPublicKey;
        validWinningWitness = entry.witness;
      }
    }

    if (highestBid < 0 || !validWinningWitness) {
      return { success: false, message: 'No valid matching bid commitments found for settlement.' };
    }

    const proofPayload = `SETTLEMENT-VERIFIED[Winner:${highestBidderPk}|Price:${highestBid}]`;
    const settlementProof = await SealedBidAuctionContract.computeHash(proofPayload);

    this.winner = {
      winnerPublicKey: highestBidderPk,
      winningBidAmount: highestBid,
      settlementProof,
      settledAt: Date.now()
    };

    this.state = 'Settled';

    return {
      success: true,
      winner: this.winner,
      message: `Auction settled! Selective disclosure: Winner ${highestBidderPk.slice(0, 10)}... won at $${highestBid}.`
    };
  }

  /**
   * Observer Privacy Inspector: Returns strictly what a public observer can see
   */
  public getPublicObserverView() {
    return {
      auctionId: this.id,
      title: this.title,
      description: this.description,
      minBidAmount: this.minBidAmount,
      state: this.state,
      totalBidsCount: this.commitments.length,
      publicCommitments: this.commitments.map(c => ({
        bidder: c.bidderPublicKey.slice(0, 10) + '...',
        commitmentHash: c.commitmentHash,
        timestamp: new Date(c.timestamp).toISOString(),
        bidAmountStatus: '🔒 Confidential (HIDDEN ON-CHAIN)'
      })),
      disclosedWinner: this.winner ? {
        winner: this.winner.winnerPublicKey,
        winningAmount: `$${this.winner.winningBidAmount}`,
        settlementProof: this.winner.settlementProof,
        losingBidsStatus: '🔒 All non-winning bids remain 100% hidden forever'
      } : null
    };
  }
}
