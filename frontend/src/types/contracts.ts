/**
 * TypeScript interfaces for Aegis Protocol contract interactions.
 */

/** On-chain lock data returned by AegisVesting.getLockInfo() */
export interface OnChainLockInfo {
  lockId: number;
  tokenAddress: string;
  beneficiary: string;
  creator: string;
  totalAmount: bigint;
  claimedAmount: bigint;
  startTime: number;
  duration: number;
  cliffDuration: number;
  vestingMode: 'LINEAR' | 'CLIFF';
  isActive: boolean;
}

/** Input parameters for creating a new lock via lockTokens() */
export interface LockCreationParams {
  tokenAddress: string;
  beneficiary: string;
  amount: bigint;
  durationDays: number;
  vestingMode: 'LINEAR' | 'CLIFF';
}
