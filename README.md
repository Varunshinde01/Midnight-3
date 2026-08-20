# Midnight Eclipse — Production-Grade Sealed-Bid Auction dApp

[![Midnight Eclipse CI/CD Pipeline](https://github.com/midnight-network/midnight-eclipse-dapp/actions/workflows/ci.yml/badge.svg)](https://github.com/midnight-network/midnight-eclipse-dapp/actions)
[![Midnight Compact Protocol](https://img.shields.io/badge/Midnight-Compact_0.1.0-7c3aed.svg)](https://midnight.network)
[![Vitest Test Suite](https://img.shields.io/badge/Tests-5%2F5_Passing-4ade80.svg)](./src/test/auction.test.ts)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> *"Half light, half shadow — the truest picture of Midnight itself."*

**Midnight Eclipse** is a production-grade decentralized application (dApp) built on Midnight's **selective disclosure privacy model**. It enables bidders to participate in confidential sealed-bid auctions where bids remain 100% hidden during the bidding phase. Upon settlement, a Zero-Knowledge (ZK) proof selectively discloses **only** the winning bid and winner address, while all losing bids remain unrevealed forever.

---

## 🌓 Privacy Model: What an Observer Can and Cannot Learn

Midnight utilizes a dual-state architecture dividing state into **Public Ledger State** and **Private Witness State**:

```
+-----------------------------------------------------------------------+
|                          ON-CHAIN PUBLIC STATE                        |
|  - Auction Title, Description & Seller Public Key                      |
|  - Minimum Threshold Price                                             |
|  - SHA-256 Bid Commitment Hashes: H = SHA256(amount || salt || pk)    |
|  - Total Bids Count & Unique Nullifiers                                |
|  - Disclosed Winner Public Key & Winning Bid (Post-Settlement Only)   |
+------------------------------------+----------------------------------+
                                     |
                          [SELECTIVE DISCLOSURE]
                                     |
+------------------------------------+----------------------------------+
|                          PRIVATE WITNESS STATE                        |
|  - Exact Confidential Bid Amounts (e.g. $650 tDUST)                   |
|  - Secret Blinding Salts                                              |
|  - Bidder Private Keys (sk)                                           |
|  - All Non-Winning Bids (Never Disclosed On-Chain)                    |
+-----------------------------------------------------------------------+
```

### 🌕 What an On-Chain Observer CAN Learn
1. **Auction Metadata**: Item description, seller public key, start/end timestamps, and minimum required bid threshold.
2. **Commitment Hashes**: 256-bit SHA-256 hash digests representing active sealed bids.
3. **Participant Volume**: Total count of valid zero-knowledge proofs registered on the contract.
4. **Settled Winner Details**: Winning bidder's public key and the winning settlement price (disclosed only after settlement).

### 🌓 What an Observer CANNOT Learn
1. **Exact Confidential Bids**: Bidders' raw bid amounts are strictly kept in client-side private witness state.
2. **Secret Salts & Blinding Factors**: Random blinding inputs used to hide bid valuations cannot be inverted or brute-forced.
3. **Losing Bids**: Bids that did not win the auction are **NEVER** revealed on-chain, preserving strategic pricing privacy permanently.
4. **Bidder Identity prior to Settlement**: Bidders submit bids with unique nullifiers to prevent double-bidding without revealing account identity.

---

## 🚀 Key Features

- **Midnight Compact Smart Contract**: Written in Midnight Compact (`SealedBidAuction.compact`) defining ledger state, witness declarations, and circuit constraints.
- **Client-Side ZK Prover**: Real-time browser witness compiler and circuit constraint validator.
- **Dual Perspective View**: Interactive toggle to switch between **Bidder View (Private Witness)** and **Observer View (Public Ledger)**.
- **Wallet Connection Bridge**: Supports Lace Wallet integration and Midnight Devnet Mock Bridge for instant offline demoing.
- **Automated CI/CD Pipeline**: GitHub Actions workflow testing matrix builds and test assertions on every commit.

---

## 🛠 Project Structure

```
Midnight-3/
├── .github/workflows/
│   └── ci.yml                     # GitHub Actions CI/CD Pipeline
├── src/
│   ├── contract/
│   │   ├── SealedBidAuction.compact # Midnight Compact Smart Contract
│   │   └── SealedBidAuction.ts      # TypeScript Contract & ZK Engine
│   ├── test/
│   │   └── auction.test.ts          # Vitest Unit Test Suite (5 Tests)
│   ├── utils/
│   │   └── privacyInspector.ts      # Privacy Analysis Utility
│   ├── App.tsx                      # Modern Glassmorphism dApp Interface
│   ├── main.tsx                     # Vite Entry Point
│   └── index.css                    # Glassmorphism Dark Theme Design System
├── PRODUCT_PROPOSAL.md              # Formal Product Proposal Submission
├── package.json                     # Dependencies & Scripts
├── vite.config.js                   # Vite & Vitest Configuration
└── README.md                        # Documentation
```

---

## 🧪 Testing & Verification

The repository includes 5 comprehensive Vitest tests verifying the privacy guarantees and circuit assertions:

```bash
# Run the unit test suite locally
npm test
```

### Passing Test Assertions:
1. `✓ Test 1: Selective Disclosure - Commitment hides private bid amount and salt`
2. `✓ Test 2: ZK Circuit - Valid bid (>= min bid) successfully passes proof generation`
3. `✓ Test 3: ZK Circuit - Invalid bid (< min bid) fails circuit constraint check`
4. `✓ Test 4: Settlement & Selective Disclosure - Winner disclosed, losing bids stay hidden`
5. `✓ Test 5: Nullifier Verification - Double-bidding with same key is rejected`

---

## 💻 Local Development Setup

### Prerequisites
- Node.js `v20.x` or `v22.x`
- npm `v10.x` or higher

### Installation & Run

1. Clone repository:
   ```bash
   git clone https://github.com/your-username/midnight-eclipse-dapp.git
   cd midnight-eclipse-dapp
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run development server:
   ```bash
   npm run dev
   ```

4. Build production bundle:
   ```bash
   npm run build
   ```

---

## 📜 Submission Checklist Verification

- [x] **Fully functional dApp** using Midnight's selective disclosure model
- [x] **Minimum 3 tests passing** (5/5 tests passing in Vitest suite)
- [x] **CI/CD pipeline running** (`.github/workflows/ci.yml` configured)
- [x] **Product Proposal submitted** (`PRODUCT_PROPOSAL.md`)
- [x] **Privacy Model section in README** (Detailed breakdown provided)
- [x] **10+ Meaningful Commits** (Clean Git trajectory)

---

## 📄 License

MIT License © 2026 Midnight Eclipse Team
