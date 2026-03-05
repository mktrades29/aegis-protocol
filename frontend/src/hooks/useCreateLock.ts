/**
 * useCreateLock — Transaction hook for creating a new vesting lock.
 *
 * Handles the full flow: simulate → sign → broadcast → refresh.
 */
import { useState, useCallback } from 'react';
import { useAegisWallet } from '../context/WalletContext';
import { createLock } from '../services/vestingService';
import type { LockCreationParams } from '../types/contracts';
import type { AbstractRpcProvider } from 'opnet';
import type { Network } from '@btc-vision/bitcoin';

interface UseCreateLockReturn {
  execute: (params: LockCreationParams) => Promise<string | null>;
  isExecuting: boolean;
  error: string | null;
  txId: string | null;
}

export function useCreateLock(): UseCreateLockReturn {
  const { address, provider, signer, network, refreshData } = useAegisWallet();
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txId, setTxId] = useState<string | null>(null);

  const execute = useCallback(
    async (params: LockCreationParams): Promise<string | null> => {
      if (!address || !provider || !signer) {
        setError('Wallet not connected');
        return null;
      }

      setIsExecuting(true);
      setError(null);
      setTxId(null);

      try {
        // 1. Simulate the transaction
        const simulation = await createLock(
          params,
          address,
          provider as AbstractRpcProvider,
          network as Network,
        );

        if (simulation.revert) {
          throw new Error(`Transaction would revert: ${simulation.revert}`);
        }

        // 2. Sign and broadcast via wallet
        const signerInstance = signer as { p2tr: string };
        const receipt = await simulation.sendTransaction({
          signer: signer as never,
          mldsaSigner: null,
          refundTo: signerInstance.p2tr,
          maximumAllowedSatToSpend: 100_000n,
          feeRate: 10,
          network: network as Network,
        });

        const transactionId = receipt.transactionId;
        setTxId(transactionId);

        // 3. Refresh data after successful transaction
        refreshData();

        return transactionId;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Transaction failed';
        console.error('[Aegis] Lock creation failed:', err);
        setError(message);
        return null;
      } finally {
        setIsExecuting(false);
      }
    },
    [address, provider, signer, network, refreshData],
  );

  return { execute, isExecuting, error, txId };
}
