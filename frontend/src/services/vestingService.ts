/**
 * AegisVesting contract read/write service.
 * All read calls return parsed domain types; write calls return simulation results.
 */
import { getContract, type AbstractRpcProvider } from 'opnet';
import type { Network } from '@btc-vision/bitcoin';
import { AEGIS_VESTING_ABI } from '../config/abis';
import { config } from '../config/env';
import type { OnChainLockInfo, LockCreationParams } from '../types/contracts';

const DAY = 86400;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function vestingContract(provider: AbstractRpcProvider, network: Network, sender?: string): any {
  return getContract(config.aegisVestingAddress, AEGIS_VESTING_ABI, provider, network, sender as any);
}

/** Fetch total number of locks created. */
export async function fetchLockCount(
  provider: AbstractRpcProvider,
  network: Network,
): Promise<number> {
  const contract = vestingContract(provider, network);
  const result = await contract.getLockCount();
  if (result.revert) throw new Error(`getLockCount reverted: ${result.revert}`);
  const props = result.properties as Record<string, unknown>;
  return Number(props.count);
}

/** Fetch a single lock's info by ID. */
export async function fetchLockInfo(
  lockId: number,
  provider: AbstractRpcProvider,
  network: Network,
): Promise<OnChainLockInfo> {
  const contract = vestingContract(provider, network);
  const result = await contract.getLockInfo(BigInt(lockId));
  if (result.revert) throw new Error(`getLockInfo reverted: ${result.revert}`);

  const p = result.properties as Record<string, unknown>;
  return {
    lockId,
    tokenAddress: String(p.token),
    beneficiary: String(p.beneficiary),
    creator: String(p.creator),
    totalAmount: BigInt(p.totalAmount as bigint),
    claimedAmount: BigInt(p.claimed as bigint),
    startTime: Number(p.startTime),
    duration: Number(p.duration),
    cliffDuration: Number(p.cliffDuration),
    vestingMode: Number(p.vestingMode) === 0 ? 'LINEAR' : 'CLIFF',
    isActive: Number(p.isActive) === 1,
  };
}

/** Fetch all locks in parallel. */
export async function fetchAllLocks(
  provider: AbstractRpcProvider,
  network: Network,
): Promise<OnChainLockInfo[]> {
  const count = await fetchLockCount(provider, network);
  if (count === 0) return [];

  const promises = Array.from({ length: count }, (_, i) =>
    fetchLockInfo(i + 1, provider, network),
  );
  return Promise.all(promises);
}

/** Fetch protocol-level stats (TVL + lock count). */
export async function fetchProtocolStats(
  provider: AbstractRpcProvider,
  network: Network,
): Promise<{ totalValueLocked: number; totalLocks: number }> {
  const contract = vestingContract(provider, network);

  const [tvlResult, countResult] = await Promise.all([
    contract.getGlobalTVL(),
    contract.getLockCount(),
  ]);

  if (tvlResult.revert) throw new Error(`getGlobalTVL reverted: ${tvlResult.revert}`);
  if (countResult.revert) throw new Error(`getLockCount reverted: ${countResult.revert}`);

  return {
    totalValueLocked: Number((tvlResult.properties as Record<string, unknown>).tvl),
    totalLocks: Number((countResult.properties as Record<string, unknown>).count),
  };
}

/** Simulate a lockTokens call. Returns the CallResult for the caller to send via wallet. */
export async function createLock(
  params: LockCreationParams,
  senderAddress: string,
  provider: AbstractRpcProvider,
  network: Network,
) {
  const contract = vestingContract(provider, network, senderAddress);
  const durationSecs = BigInt(params.durationDays * DAY);
  const cliffSecs = params.vestingMode === 'CLIFF' ? durationSecs : 0n;
  const modeValue = params.vestingMode === 'LINEAR' ? 0n : 1n;

  const result = await contract.lockTokens(
    params.tokenAddress,
    params.beneficiary,
    params.amount,
    durationSecs,
    cliffSecs,
    modeValue,
  );

  return result;
}

/** Simulate a claim call. Returns the CallResult for the caller to send via wallet. */
export async function claimVestedTokens(
  lockId: number,
  senderAddress: string,
  provider: AbstractRpcProvider,
  network: Network,
) {
  const contract = vestingContract(provider, network, senderAddress);
  const result = await contract.claim(BigInt(lockId));
  return result;
}
