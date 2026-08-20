/**
 * Privacy Inspector Helper Utility
 * Analyzes state payloads and outputs structured selective disclosure reports.
 */

export interface SelectiveDisclosureReport {
  timestamp: string;
  publicStateDisclosures: {
    field: string;
    value: string;
    visibility: '🌕 Public (Disclosed On-Chain)';
  }[];
  privateStateWitnesses: {
    field: string;
    value: string;
    visibility: '🌓 Shadow (Zero-Knowledge Private State)';
  }[];
}

export function generatePrivacyReport(
  auctionTitle: string,
  bidderPk: string,
  bidAmount: number,
  salt: string,
  commitmentHash: string
): SelectiveDisclosureReport {
  return {
    timestamp: new Date().toISOString(),
    publicStateDisclosures: [
      { field: 'Auction Title', value: auctionTitle, visibility: '🌕 Public (Disclosed On-Chain)' },
      { field: 'Bidder Public Key', value: `${bidderPk.slice(0, 10)}...`, visibility: '🌕 Public (Disclosed On-Chain)' },
      { field: 'Commitment Hash (SHA-256)', value: `${commitmentHash.slice(0, 18)}...`, visibility: '🌕 Public (Disclosed On-Chain)' }
    ],
    privateStateWitnesses: [
      { field: 'Exact Bid Amount', value: `$${bidAmount} tDUST`, visibility: '🌓 Shadow (Zero-Knowledge Private State)' },
      { field: 'Secret Salt', value: salt, visibility: '🌓 Shadow (Zero-Knowledge Private State)' },
      { field: 'Private Key Witness', value: '●●●●●●●●●●●●', visibility: '🌓 Shadow (Zero-Knowledge Private State)' }
    ]
  };
}
