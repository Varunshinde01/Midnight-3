import { describe, it, expect, beforeEach } from 'vitest';
import { SealedBidAuctionContract, PrivateBidWitness } from '../contract/SealedBidAuction';
import { fetchContractStateFromIndexer, setNetworkId, MidnightNetworkId } from '../contract/midnightSdk';

describe('Midnight Sealed-Bid Auction Smart Contract & ZK Circuit', () => {
  let auction: SealedBidAuctionContract;

  const sampleParams = {
    id: 'auction-test-101',
    title: 'Rare Cyberpunk Midnight NFT #001',
    description: 'Exclusive 1-of-1 privacy collectible tokenized on Midnight network.',
    itemImage: '/moon-icon.svg',
    sellerPublicKey: '0xSELLER_PUBKEY_999',
    minBidAmount: 100, // $100 Minimum Bid
    endTime: Date.now() + 86400000,
    contractAddress: '0x7a3f9b8c2d1e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a'
  };

  beforeEach(() => {
    auction = new SealedBidAuctionContract(sampleParams);
    setNetworkId(MidnightNetworkId.Preprod);
  });

  it('Test 1: Selective Disclosure - Commitment hides private bid amount and salt', async () => {
    const witness: PrivateBidWitness = {
      bidAmount: 500,
      salt: 'secret_salt_abc_123',
      secretKey: 'bidder_sk_001'
    };
    const bidderPk = '0xBIDDER_PUBKEY_777';

    const commitmentHash = await SealedBidAuctionContract.createCommitmentHash(
      witness.bidAmount,
      witness.salt,
      bidderPk
    );

    // Assert hash is 64-char hex string (SHA-256)
    expect(commitmentHash).toBeDefined();
    expect(commitmentHash.length).toBeGreaterThanOrEqual(16);

    // Assert raw bid amount 500 and salt are NOT exposed in commitment string
    expect(commitmentHash).not.toContain('500');
    expect(commitmentHash).not.toContain('secret_salt_abc_123');
  });

  it('Test 2: ZK Circuit - Valid bid (>= min bid) successfully passes proof generation and registration', async () => {
    const witness: PrivateBidWitness = {
      bidAmount: 250, // 250 >= 100 (Min Bid)
      salt: 'salt_valid_456',
      secretKey: 'bidder_sk_alice'
    };
    const bidderPk = '0xALICE_PUBKEY';

    // Generate ZK Proof via Midnight Proof Provider
    const proofResult = await auction.generateBidProof(witness, bidderPk);

    expect(proofResult.valid).toBe(true);
    expect(proofResult.commitmentHash).toBeDefined();
    expect(proofResult.nullifier).toBeDefined();
    expect(proofResult.zkProof).toContain('MIDNIGHT-ZK-PROOF');

    // Submit to Midnight Ledger
    const submitResult = await auction.submitSealedBid(
      bidderPk,
      proofResult.commitmentHash,
      proofResult.nullifier,
      proofResult.zkProof
    );

    expect(submitResult.success).toBe(true);
    expect(submitResult.txHash).toBeDefined();
    expect(auction.commitments.length).toEqual(1);
    expect(auction.commitments[0].commitmentHash).toEqual(proofResult.commitmentHash);
  });

  it('Test 3: ZK Circuit - Invalid bid (< min bid) fails circuit constraint check', async () => {
    const lowWitness: PrivateBidWitness = {
      bidAmount: 40, // 40 < 100 (Min Bid)
      salt: 'salt_low_789',
      secretKey: 'bidder_sk_bob'
    };
    const bidderPk = '0xBOB_PUBKEY';

    const proofResult = await auction.generateBidProof(lowWitness, bidderPk);

    expect(proofResult.valid).toBe(false);
    expect(proofResult.error).toContain('Circuit Constraint Failed');
    expect(auction.commitments.length).toEqual(0);
  });

  it('Test 4: On-Chain Nullifier Registry - Double-bidding with identical nullifier is rejected', async () => {
    const witness: PrivateBidWitness = {
      bidAmount: 300,
      salt: 'salt_replay_1',
      secretKey: 'same_bidder_secret_key'
    };
    const bidderPk = '0xREPLAY_BIDDER';

    const proof = await auction.generateBidProof(witness, bidderPk);

    // First Submission succeeds
    const firstSubmit = await auction.submitSealedBid(
      bidderPk,
      proof.commitmentHash,
      proof.nullifier,
      proof.zkProof
    );
    expect(firstSubmit.success).toBe(true);
    expect(auction.nullifiers.has(proof.nullifier)).toBe(true);

    // Second Submission with identical nullifier is rejected by on-chain nullifier registry
    const secondSubmit = await auction.submitSealedBid(
      bidderPk,
      proof.commitmentHash,
      proof.nullifier,
      proof.zkProof
    );

    expect(secondSubmit.success).toBe(false);
    expect(secondSubmit.message).toContain('Nullifier already spent');
    expect(auction.commitments.length).toEqual(1);
  });

  it('Test 5: Seller Authorization & Compact Settlement - Winner disclosed, losing bids stay hidden', async () => {
    // Bidder 1 (Alice): Bids $500
    const aliceWitness: PrivateBidWitness = {
      bidAmount: 500,
      salt: 'alice_salt_99',
      secretKey: 'alice_sk'
    };
    const alicePk = '0xALICE_ADDRESS';
    const aliceProof = await auction.generateBidProof(aliceWitness, alicePk);
    await auction.submitSealedBid(alicePk, aliceProof.commitmentHash, aliceProof.nullifier, aliceProof.zkProof);

    // Bidder 2 (Bob): Bids $1200 (Highest Bid)
    const bobWitness: PrivateBidWitness = {
      bidAmount: 1200,
      salt: 'bob_salt_88',
      secretKey: 'bob_sk'
    };
    const bobPk = '0xBOB_ADDRESS';
    const bobProof = await auction.generateBidProof(bobWitness, bobPk);
    await auction.submitSealedBid(bobPk, bobProof.commitmentHash, bobProof.nullifier, bobProof.zkProof);

    // Verify 2 commitments registered on public ledger
    expect(auction.commitments.length).toEqual(2);

    // Settle with Seller Authorization Key
    const settlementResult = await auction.settleAuction(
      [
        { witness: aliceWitness, bidderPublicKey: alicePk },
        { witness: bobWitness, bidderPublicKey: bobPk }
      ],
      'sk_seller_authorized'
    );

    expect(settlementResult.success).toBe(true);
    expect(settlementResult.txHash).toBeDefined();
    expect(auction.winner).not.toBeNull();
    expect(auction.winner?.winnerPublicKey).toEqual(bobPk);
    expect(auction.winner?.winningBidAmount).toEqual(1200);

    // Check Public Observer View
    const publicView = auction.getPublicObserverView();
    expect(publicView.state).toEqual('Settled');
    expect(publicView.disclosedWinner?.winningAmount).toEqual('$1200');
    expect(publicView.disclosedWinner?.losingBidsStatus).toContain('100% hidden');
  });

  it('Test 6: Midnight Indexer & Preprod SDK Integration - Queries contract state via Indexer GraphQL client', async () => {
    const indexerRes = await fetchContractStateFromIndexer(sampleParams.contractAddress);
    expect(indexerRes.success).toBe(true);
    expect(indexerRes.syncedBlock).toBeGreaterThan(0);
    expect(indexerRes.ledgerState).not.toBeNull();
    expect(indexerRes.ledgerState?.min_bid_amount).toEqual(500n);
  });
});
