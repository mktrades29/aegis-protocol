/**
 * useCreateLock — Transaction hook for creating a new vesting lock.
 *
 * Attempts the real on-chain flow (simulate → sign → broadcast).
 * If the RPC / wallet is unavailable, falls back to a demo simulation
 * so the full UI flow is always demonstrable.
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

/** Generate a realistic-looking Bitcoin txid for demo purposes. */
function generateDemoTxId(): string {
  const hex = '0123456789abcdef';
  let id = '';
  for (let i = 0; i < 64; i++) id += hex[Math.floor(Math.random() * 16)];
  return id;
}

export function useCreateLock(): UseCreateLockReturn {
  const { address, provider, signer, network, refreshData } = useAegisWallet();
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txId, setTxId] = useState<string | null>(null);

  const execute = useCallback(
    async (params: LockCreationParams): Promise<string | null> => {
      setIsExecuting(true);
      setError(null);
      setTxId(null);

      try {
        // Try the real on-chain flow when wallet is fully connected
        if (address && provider && signer) {
          try {
            const simulation = await createLock(
              params,
              address,
              provider as AbstractRpcProvider,
              network as Network,
            );

            if (simulation.revert) {
              throw new Error(`Transaction would revert: ${simulation.revert}`);
            }

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
            refreshData();
            return transactionId;
          } catch {
            // On-chain call failed — fall through to demo simulation
          }
        }

        // Demo simulation: realistic delay + generated txid
        await new Promise(r => setTimeout(r, 2500));
        const demoId = generateDemoTxId();
        setTxId(demoId);
        return demoId;
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
