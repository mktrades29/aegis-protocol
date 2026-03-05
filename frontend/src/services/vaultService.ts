/**
 * AegisVault contract read service (read-only calls).
 */
import { getContract, type AbstractRpcProvider } from 'opnet';
import type { Network } from '@btc-vision/bitcoin';
import { AEGIS_VAULT_ABI } from '../config/abis';
import { config } from '../config/env';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function vaultContract(provider: AbstractRpcProvider, network: Network): any {
  return getContract(config.aegisVaultAddress, AEGIS_VAULT_ABI, provider, network);
}

/** Fetch accumulated fees for a specific token. */
export async function fetchAccumulatedFees(
  tokenAddress: string,
  provider: AbstractRpcProvider,
  network: Network,
): Promise<bigint> {
  const contract = vaultContract(provider, network);
  const result = await contract.getAccumulatedFees(tokenAddress);
  if (result.revert) throw new Error(`getAccumulatedFees reverted: ${result.revert}`);
  return BigInt((result.properties as Record<string, unknown>).fees as bigint);
}
