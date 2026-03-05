/**
 * Typed environment configuration accessor.
 * Reads from Vite's import.meta.env at build time.
 */
export const config = {
  /** Empty string = same-origin proxy (Vercel rewrite / Vite dev proxy to regtest.opnet.org) */
  rpcUrl: '',
  network: import.meta.env.VITE_NETWORK as string || 'regtest',
  aegisVestingAddress: import.meta.env.VITE_AEGIS_VESTING_ADDRESS as string || '',
  aegisVaultAddress: import.meta.env.VITE_AEGIS_VAULT_ADDRESS as string || '',
};

/** Returns true when both contract addresses are configured. */
export function isConfigured(): boolean {
  return config.aegisVestingAddress.length > 0 && config.aegisVaultAddress.length > 0;
}
