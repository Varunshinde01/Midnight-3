import { describe, it, expect, beforeEach } from 'vitest';
import { SealedBidAuctionContract, PrivateBidWitness } from '../contract/SealedBidAuction';
import { fetchContractStateFromIndexer, connectLaceWallet, setNetworkId, MidnightNetworkId } from '../contract/midnightSdk';

describe('Midnight Sealed-Bid Auction Smart Contract & ZK Circuit Test Suite', () => {
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

    expect(commitmentHash).toBeDefined();
    expect(commitmentHash.length).toBeGreaterThanOrEqual(16);
    expect(commitmentHash).not.toContain('500');
    expect(commitmentHash).not.toContain('secret_salt_abc_123');
  });

  it('Test 2: ZK Circuit - Valid bid (>= min bid) passes proof generation and ledger registration', async () => {
    const witness: PrivateBidWitness = {
      bidAmount: 250, // 250 >= 100
      salt: 'salt_valid_456',
      secretKey: 'bidder_sk_alice'
    };
    const bidderPk = '0xALICE_PUBKEY';

    const proofResult = await auction.generateBidProof(witness, bidderPk);

    expect(proofResult.valid).toBe(true);
    expect(proofResult.commitmentHash).toBeDefined();
    expect(proofResult.nullifier).toBeDefined();
    expect(proofResult.zkProof).toContain('MIDNIGHT-ZK-PROOF');

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

  it('Test 3: ZK Circuit Constraint - Invalid bid (< min bid) fails circuit check', async () => {
    const lowWitness: PrivateBidWitness = {
      bidAmount: 40, // 40 < 100
      salt: 'salt_low_789',
      secretKey: 'bidder_sk_bob'
    };
    const bidderPk = '0xBOB_PUBKEY';

    const proofResult = await auction.generateBidProof(lowWitness, bidderPk);

    expect(proofResult.valid).toBe(false);
    expect(proofResult.error).toContain('below minimum');
    expect(auction.commitments.length).toEqual(0);
  });

  it('Test 4: On-Chain Nullifier Registry - Replay attack with spent nullifier is rejected', async () => {
    const witness: PrivateBidWitness = {
      bidAmount: 300,
      salt: 'salt_replay_1',
      secretKey: 'same_bidder_secret_key'
    };
    const bidderPk = '0xREPLAY_BIDDER';

    const proof = await auction.generateBidProof(witness, bidderPk);

    // First submission succeeds
    const firstSubmit = await auction.submitSealedBid(
      bidderPk,
      proof.commitmentHash,
      proof.nullifier,
      proof.zkProof
    );
    expect(firstSubmit.success).toBe(true);
    expect(auction.nullifiers.has(proof.nullifier)).toBe(true);

    // Duplicate submission with identical nullifier is rejected
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

  it('Test 5: Unauthorized Settlement Rejection - Settlement by non-seller fails', async () => {
    const witness: PrivateBidWitness = {
      bidAmount: 500,
      salt: 'salt_unauth_test',
      secretKey: 'bidder_sk'
    };
    const bidderPk = '0xBIDDER_PUBKEY';
    const proof = await auction.generateBidProof(witness, bidderPk);
    await auction.submitSealedBid(bidderPk, proof.commitmentHash, proof.nullifier, proof.zkProof);

    // Attempt settlement with unauthorized seller key
    const result = await auction.settleAuction(
      [{ witness, bidderPublicKey: bidderPk }],
      'sk_unauthorized_attacker_key'
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain('Unauthorized settlement');
    expect(auction.state).toEqual('Bidding');
    expect(auction.winner).toBeNull();
  });

  it('Test 6: Seller Authorization & Winner Verification - Settlement selects highest valid registered bid', async () => {
    // Bidder 1 (Alice): $500
    const aliceWitness: PrivateBidWitness = { bidAmount: 500, salt: 'alice_salt', secretKey: 'alice_sk' };
    const alicePk = '0xALICE_PUBKEY';
    const aliceProof = await auction.generateBidProof(aliceWitness, alicePk);
    await auction.submitSealedBid(alicePk, aliceProof.commitmentHash, aliceProof.nullifier, aliceProof.zkProof);

    // Bidder 2 (Bob): $1200 (Highest)
    const bobWitness: PrivateBidWitness = { bidAmount: 1200, salt: 'bob_salt', secretKey: 'bob_sk' };
    const bobPk = '0xBOB_PUBKEY';
    const bobProof = await auction.generateBidProof(bobWitness, bobPk);
    await auction.submitSealedBid(bobPk, bobProof.commitmentHash, bobProof.nullifier, bobProof.zkProof);

    // Bidder 3 (Charlie): $800
    const charlieWitness: PrivateBidWitness = { bidAmount: 800, salt: 'charlie_salt', secretKey: 'charlie_sk' };
    const charliePk = '0xCHARLIE_PUBKEY';
    const charlieProof = await auction.generateBidProof(charlieWitness, charliePk);
    await auction.submitSealedBid(charliePk, charlieProof.commitmentHash, charlieProof.nullifier, charlieProof.zkProof);

    expect(auction.commitments.length).toEqual(3);

    // Settle with Authorized Seller Key
    const settlementResult = await auction.settleAuction(
      [
        { witness: aliceWitness, bidderPublicKey: alicePk },
        { witness: bobWitness, bidderPublicKey: bobPk },
        { witness: charlieWitness, bidderPublicKey: charliePk }
      ],
      'sk_seller_authorized'
    );

    expect(settlementResult.success).toBe(true);
    expect(auction.winner).not.toBeNull();
    expect(auction.winner?.winnerPublicKey).toEqual(bobPk);
    expect(auction.winner?.winningBidAmount).toEqual(1200);

    // Observer privacy check
    const observerView = auction.getPublicObserverView();
    expect(observerView.state).toEqual('Settled');
    expect(observerView.disclosedWinner?.winningAmount).toEqual('$1200');
    expect(observerView.disclosedWinner?.losingBidsStatus).toContain('100% hidden');
  });

  it('Test 7: Midnight Indexer Client - Production query handling and simulation fallback', async () => {
    // In production without fallback (fails cleanly if unreachable)
    const prodRes = await fetchContractStateFromIndexer(sampleParams.contractAddress, { allowSimulationFallback: false });
    expect(prodRes.isSimulated).toBe(false);

    // With explicit simulation fallback
    const simRes = await fetchContractStateFromIndexer(sampleParams.contractAddress, { allowSimulationFallback: true });
    expect(simRes.success).toBe(true);
    expect(simRes.isSimulated).toBe(true);
    expect(simRes.ledgerState).not.toBeNull();
  });

  it('Test 8: Wallet Connection - Explicit simulated fallback mode when Lace extension is absent', async () => {
    const walletRes = await connectLaceWallet(true);
    expect(walletRes.connected).toBe(true);
    expect(walletRes.isSimulated).toBe(true);
    expect(walletRes.warning).toContain('Simulated Bridge');
  });
});
