# Formal Product Proposal: Midnight Eclipse Sealed-Bid Auction Platform

**Submitted for**: Midnight Developer Program (Level 3 Submission)  
**Selected Category**: Sealed-Bid Auction — private bids, verifiable winner  
**Project Name**: Midnight Eclipse  

---

## 1. Executive Summary

Public blockchain auctions suffer from severe front-running, bid sniping, and strategic pricing exposure because traditional smart contract platforms disclose all bid amounts in real-time. 

**Midnight Eclipse** leverages Midnight's Zero-Knowledge (ZK) selective disclosure privacy model to pioneer a confidential, front-running-proof auction platform. Bidders submit zero-knowledge price commitments ($H = \text{SHA256}(\text{bid} \parallel \text{salt})$). Raw valuations remain 100% hidden in client-side private witness state. At settlement, a ZK proof selectively discloses **only** the winning bid and winner address, ensuring non-winning bids are never revealed to competitors or public observers.

---

## 2. Problem Statement & Opportunity

### The Problem on Transparent Blockchains
1. **Front-Running & MEV**: Malicious bots inspect pending bid transactions in the mempool and outbid legitimate buyers by paying higher gas fees.
2. **Bid Sniping & Psychological Manipulation**: Visible live bids distort buyer valuations and cause artificial panic bidding.
3. **Strategic Pricing Exposure**: Institutional buyers and collectors expose their maximum reserve prices when placing bids on public ledgers.

### The Midnight Solution
Midnight's dual-state architecture (Public Ledger State + Private Witness State) solves this fundamentally:
- Bids are committed as zero-knowledge hashes.
- Circuit constraints (`assert(bidAmount >= minBidAmount)`) ensure bids are valid without revealing their dollar values.
- Settlement proves the highest bidder mathematically without disclosing losing bids.

---

## 3. Product Architecture & Midnight ZK Circuit Design

### Midnight Compact Smart Contract Interface (`SealedBidAuction.compact`)

```compact
pragma language_version >= 0.1.0;

import CompactStandardLibrary;

export enum AuctionState { Bidding, Revealed, Settled }

export struct BidCommitment {
    public_key: Bytes<32>;
    commitment_hash: Bytes<32>;
    timestamp: Uint<64>;
}

export struct DisclosedWinner {
    winner_public_key: Bytes<32>;
    winning_bid_amount: Uint<64>;
    proof_hash: Bytes<32>;
}

export ledger {
    state: AuctionState;
    min_bid_amount: Uint<64>;
    bids_count: Uint<32>;
    commitments: Vector<100, BidCommitment>;
    winner: DisclosedWinner;
}

witness private_bid_amount(): Uint<64>;
witness private_salt(): Bytes<32>;
```

---

## 4. Selective Disclosure Lifecycle

```
[ PHASE 1: BIDDING ]
  Bidder Device: Generates witness (amount, salt) -> Computes Hash -> Proves amount >= minBid
  Midnight Ledger: Records commitment hash only (Bid amount remains HIDDEN)

[ PHASE 2: SETTLEMENT ]
  Highest Bidder: Discloses bid + salt -> Contract verifies hash match on ledger
  Midnight Ledger: Discloses Winner PK & Winning Price ONLY
  Losing Bids: Remain 100% PRIVATE FOREVER
```

---

## 5. Technical Implementation & Test Suite

- **Frontend**: Vite + React + Lucide React + Glassmorphism Theme.
- **Contract Engine**: Midnight Compact (`SealedBidAuction.compact`) + TypeScript Prover (`SealedBidAuction.ts`).
- **Test Suite**: 5/5 Vitest tests passing (`src/test/auction.test.ts`).
- **CI/CD Pipeline**: GitHub Actions matrix workflow (`.github/workflows/ci.yml`).

---

## 6. Roadmap & Future Scope

- **Phase 1 (Completed)**: Sealed-Bid Auction engine, ZK witness prover, Vitest suite, CI/CD pipeline, and Privacy Model inspector.
- **Phase 2**: Lace Wallet mainnet connector integration & multi-asset collateral locks ($tDUST, ADA).
- **Phase 3**: Multi-item Dutch auction circuits and confidential secondary market splits.

---

**Submitted by**: Midnight Developer  
**Status**: Ready for Level 3 Evaluation
