/**
 * AegisWalletProvider — Central state management for wallet + on-chain data.
 *
 * Wraps useWalletConnect from @btc-vision/walletconnect and exposes:
 * - Wallet state (address, connection, connect/disconnect)
 * - On-chain data (locks, stats) with automatic fallback to mock data
 * - refreshData() for re-fetching after transactions
 */
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useWalletConnect } from '@btc-vision/walletconnect';
import type { AbstractRpcProvider } from 'opnet';
import type { VestingLock, ProtocolStats } from '../mock/data';
import { MOCK_LOCKS, MOCK_STATS } from '../mock/data';
import { isConfigured } from '../config/env';
import { getProvider, getNetwork, patchProviderForBrowser } from '../services/provider';
import { fetchAllLocks, fetchProtocolStats } from '../services/vestingService';
import type { OnChainLockInfo } from '../types/contracts';

interface AegisWalletContextType {
  // Wallet
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  connect: () => void;
  disconnect: () => void;
  // Data
  locks: VestingLock[];
  stats: ProtocolStats;
  isLoadingData: boolean;
  dataError: string | null;
  isLiveData: boolean;
  refreshData: () => void;
  // SDK access (for transaction hooks)
  provider: AbstractRpcProvider | null;
  signer: unknown;
  network: unknown;
}

const AegisWalletContext = createContext<AegisWalletContextType | null>(null);

/** Convert on-chain lock data to the VestingLock interface used by UI components. */
function onChainToVestingLock(lock: OnChainLockInfo): VestingLock {
  const addr = lock.tokenAddress;
  const shortAddr = addr.length > 8 ? addr.slice(0, 8).toUpperCase() : addr.toUpperCase();
  return {
    lockId: lock.lockId,
    tokenName: `Token ${shortAddr}`,
    tokenSymbol: shortAddr.slice(0, 4),
    tokenAddress: lock.tokenAddress,
    beneficiary: lock.beneficiary,
    creator: lock.creator,
    totalAmount: Number(lock.totalAmount),
    claimedAmount: Number(lock.claimedAmount),
    startTime: lock.startTime,
    duration: lock.duration,
    cliffDuration: lock.cliffDuration,
    vestingMode: lock.vestingMode,
    isActive: lock.isActive,
  };
}

export function AegisWalletProvider({ children }: { children: ReactNode }) {
  const wallet = useWalletConnect();

  const [locks, setLocks] = useState<VestingLock[]>(MOCK_LOCKS);
  const [stats, setStats] = useState<ProtocolStats>(MOCK_STATS);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [isLiveData, setIsLiveData] = useState(false);

  const isConnected = !!wallet.walletAddress;
  const canFetchLive = isConnected && isConfigured();

  const fetchLiveData = useCallback(async () => {
    const provider = wallet.provider ?? getProvider();
    patchProviderForBrowser(provider);
    const network = wallet.network ?? getNetwork();

    setIsLoadingData(true);
    setDataError(null);

    try {
      const [onChainLocks, onChainStats] = await Promise.all([
        fetchAllLocks(provider, network),
        fetchProtocolStats(provider, network),
      ]);

      setLocks(onChainLocks.map(onChainToVestingLock));
      setStats({
        totalValueLocked: onChainStats.totalValueLocked,
        totalLocks: onChainStats.totalLocks,
        totalTokensTracked: new Set(onChainLocks.map((l) => l.tokenAddress)).size,
        vaultFeesCollected: 0, // Could fetch from vault if needed
      });
      setIsLiveData(true);
    } catch (err) {
      console.error('[Aegis] Failed to fetch live data:', err);
      setDataError(err instanceof Error ? err.message : 'Failed to fetch on-chain data');
      // Fall back to mock data
      setLocks(MOCK_LOCKS);
      setStats(MOCK_STATS);
      setIsLiveData(false);
    } finally {
      setIsLoadingData(false);
    }
  }, [wallet.provider, wallet.network]);

  // Fetch live data when wallet connects and contracts are configured
  useEffect(() => {
    if (canFetchLive) {
      fetchLiveData();
    } else {
      // Reset to mock data
      setLocks(MOCK_LOCKS);
      setStats(MOCK_STATS);
      setIsLiveData(false);
      setDataError(null);

      if (isConnected && !isConfigured()) {
        console.warn('[Aegis] Wallet connected but contract addresses not configured in .env');
      }
    }
  }, [canFetchLive, fetchLiveData]);

  const value: AegisWalletContextType = {
    address: wallet.walletAddress,
    isConnected,
    isConnecting: wallet.connecting,
    connect: wallet.openConnectModal,
    disconnect: wallet.disconnect,
    locks,
    stats,
    isLoadingData,
    dataError,
    isLiveData,
    refreshData: fetchLiveData,
    provider: wallet.provider ?? getProvider(),
    signer: wallet.signer,
    network: wallet.network ?? getNetwork(),
  };

  return (
    <AegisWalletContext.Provider value={value}>
      {children}
    </AegisWalletContext.Provider>
  );
}

export function useAegisWallet(): AegisWalletContextType {
  const ctx = useContext(AegisWalletContext);
  if (!ctx) throw new Error('useAegisWallet must be used within <AegisWalletProvider>');
  return ctx;
}
