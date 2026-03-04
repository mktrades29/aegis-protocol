/**
 * Mock data for the Aegis Protocol frontend.
 * Simulates on-chain vesting state for UI development.
 */

export interface VestingLock {
  lockId: number;
  tokenName: string;
  tokenSymbol: string;
  tokenAddress: string;
  beneficiary: string;
  creator: string;
  totalAmount: number;
  claimedAmount: number;
  startTime: number;       // unix timestamp
  duration: number;        // seconds
  cliffDuration: number;   // seconds
  vestingMode: 'LINEAR' | 'CLIFF';
  isActive: boolean;
}

export interface ProtocolStats {
  totalValueLocked: number;
  totalLocks: number;
  totalTokensTracked: number;
  vaultFeesCollected: number;
}

// Current time for mock calculations
const NOW = Math.floor(Date.now() / 1000);
const DAY = 86400;
const MONTH = DAY * 30;

export const MOCK_LOCKS: VestingLock[] = [
  {
    lockId: 1,
    tokenName: 'OpNet Token',
    tokenSymbol: 'OPN',
    tokenAddress: 'bc1q_opn_mock_address_7f8a9b2c',
    beneficiary: 'bc1q_dev_alice_3e4f5a6b',
    creator: 'bc1q_team_founder_1a2b3c4d',
    totalAmount: 10_000_000,
    claimedAmount: 1_500_000,
    startTime: NOW - (MONTH * 3),        // Started 3 months ago
    duration: MONTH * 12,                  // 12 month vesting
    cliffDuration: MONTH * 1,              // 1 month cliff
    vestingMode: 'LINEAR',
    isActive: true,
  },
  {
    lockId: 2,
    tokenName: 'Bitcoin DeFi',
    tokenSymbol: 'BTCFI',
    tokenAddress: 'bc1q_btcfi_mock_address_9d0e1f2g',
    beneficiary: 'bc1q_dev_bob_7h8i9j0k',
    creator: 'bc1q_team_cto_5e6f7g8h',
    totalAmount: 5_000_000,
    claimedAmount: 0,
    startTime: NOW - (DAY * 15),           // Started 15 days ago
    duration: MONTH * 6,                    // 6 month vesting
    cliffDuration: MONTH * 3,               // 3 month cliff (not yet reached)
    vestingMode: 'CLIFF',
    isActive: true,
  },
  {
    lockId: 3,
    tokenName: 'Aegis Governance',
    tokenSymbol: 'AEGIS',
    tokenAddress: 'bc1q_aegis_mock_address_3h4i5j6k',
    beneficiary: 'bc1q_community_pool_2c3d4e5f',
    creator: 'bc1q_dao_treasury_8g9h0i1j',
    totalAmount: 50_000_000,
    claimedAmount: 25_000_000,
    startTime: NOW - (MONTH * 8),          // Started 8 months ago
    duration: MONTH * 18,                   // 18 month vesting
    cliffDuration: 0,                       // No cliff, pure linear
    vestingMode: 'LINEAR',
    isActive: true,
  },
  {
    lockId: 4,
    tokenName: 'Satoshi Yield',
    tokenSymbol: 'SYLD',
    tokenAddress: 'bc1q_syld_mock_address_7l8m9n0o',
    beneficiary: 'bc1q_investor_carol_4f5g6h7i',
    creator: 'bc1q_launch_pad_9j0k1l2m',
    totalAmount: 2_000_000,
    claimedAmount: 2_000_000,
    startTime: NOW - (MONTH * 7),
    duration: MONTH * 6,
    cliffDuration: 0,
    vestingMode: 'LINEAR',
    isActive: false, // fully claimed
  },
];

export const MOCK_STATS: ProtocolStats = {
  totalValueLocked: 67_000_000,
  totalLocks: 4,
  totalTokensTracked: 4,
  vaultFeesCollected: 676_767,
};

/**
 * Calculate vesting progress for a lock at the current time.
 */
export function calculateVestingProgress(lock: VestingLock): {
  percentVested: number;
  percentLocked: number;
  unlockedAmount: number;
  lockedAmount: number;
  claimableAmount: number;
  nextUnlockTime: number | null;
  timeRemaining: number;
} {
  if (!lock.isActive) {
    return {
      percentVested: 100,
      percentLocked: 0,
      unlockedAmount: lock.totalAmount,
      lockedAmount: 0,
      claimableAmount: 0,
      nextUnlockTime: null,
      timeRemaining: 0,
    };
  }

  const elapsed = Math.max(0, NOW - lock.startTime);

  let unlockedAmount: number;

  if (lock.vestingMode === 'CLIFF') {
    if (elapsed < lock.cliffDuration) {
      unlockedAmount = 0;
    } else {
      unlockedAmount = lock.totalAmount;
    }
  } else {
    // LINEAR
    if (lock.cliffDuration > 0 && elapsed < lock.cliffDuration) {
      unlockedAmount = 0;
    } else if (elapsed >= lock.duration) {
      unlockedAmount = lock.totalAmount;
    } else {
      unlockedAmount = Math.floor(lock.totalAmount * elapsed / lock.duration);
    }
  }

  const lockedAmount = lock.totalAmount - unlockedAmount;
  const claimableAmount = Math.max(0, unlockedAmount - lock.claimedAmount);
  const percentVested = (unlockedAmount / lock.totalAmount) * 100;
  const percentLocked = 100 - percentVested;

  let nextUnlockTime: number | null = null;
  const timeRemaining = Math.max(0, (lock.startTime + lock.duration) - NOW);

  if (lock.vestingMode === 'CLIFF' && elapsed < lock.cliffDuration) {
    nextUnlockTime = lock.startTime + lock.cliffDuration;
  } else if (lock.vestingMode === 'LINEAR') {
    if (lock.cliffDuration > 0 && elapsed < lock.cliffDuration) {
      nextUnlockTime = lock.startTime + lock.cliffDuration;
    } else if (elapsed < lock.duration) {
      nextUnlockTime = lock.startTime + lock.duration;
    }
  }

  return {
    percentVested,
    percentLocked,
    unlockedAmount,
    lockedAmount,
    claimableAmount,
    nextUnlockTime,
    timeRemaining,
  };
}
