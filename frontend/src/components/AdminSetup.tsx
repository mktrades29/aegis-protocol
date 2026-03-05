import { useState } from 'react';
import { Settings, Link, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { getContract, type AbstractRpcProvider } from 'opnet';
import type { Network } from '@btc-vision/bitcoin';
import { useAegisWallet } from '../context/WalletContext';
import { config } from '../config/env';
import { getProvider } from '../services/provider';
import { AEGIS_VESTING_ABI, AEGIS_VAULT_ABI } from '../config/abis';

type StepStatus = 'idle' | 'loading' | 'success' | 'error';

export default function AdminSetup() {
  const { isConnected, address, provider, signer, network } = useAegisWallet();

  const [step1Status, setStep1Status] = useState<StepStatus>('idle');
  const [step2Status, setStep2Status] = useState<StepStatus>('idle');
  const [step1Error, setStep1Error] = useState<string | null>(null);
  const [step2Error, setStep2Error] = useState<string | null>(null);

  if (!isConnected) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function sendAdminTx(contractAddr: string, abi: any, methodName: string, paramAddr: string): Promise<void> {
    const rpc = provider as AbstractRpcProvider;
    const contract = getContract(contractAddr, abi, rpc, network as Network, address as any);

    // Resolve P2OP bech32m string to an Address object (the SDK requires Address, not string).
    // Use the singleton JSONRpcProvider which has reliable RPC connectivity.
    const rpcProvider = getProvider();
    const resolvedAddress = await rpcProvider.getPublicKeyInfo(paramAddr, true);
    if (!resolvedAddress) {
      throw new Error(`Could not resolve address: ${paramAddr}`);
    }

    const result = await (contract as any)[methodName](resolvedAddress);

    if (result.revert) {
      throw new Error(result.revert);
    }

    const signerInstance = signer as { p2tr: string };
    await result.sendTransaction({
      signer: signer as never,
      mldsaSigner: null,
      refundTo: signerInstance.p2tr,
      maximumAllowedSatToSpend: 100_000n,
      feeRate: 10,
      network: network as Network,
    });
  }

  async function linkVaultToVesting() {
    setStep1Status('loading');
    setStep1Error(null);
    try {
      await sendAdminTx(
        config.aegisVaultAddress,
        AEGIS_VAULT_ABI,
        'setAuthorizedDepositor',
        config.aegisVestingAddress,
      );
      setStep1Status('success');
    } catch (err) {
      setStep1Error(err instanceof Error ? err.message : 'Transaction failed');
      setStep1Status('error');
    }
  }

  async function linkVestingToVault() {
    setStep2Status('loading');
    setStep2Error(null);
    try {
      await sendAdminTx(
        config.aegisVestingAddress,
        AEGIS_VESTING_ABI,
        'setVaultAddress',
        config.aegisVaultAddress,
      );
      setStep2Status('success');
    } catch (err) {
      setStep2Error(err instanceof Error ? err.message : 'Transaction failed');
      setStep2Status('error');
    }
  }

  const bothDone = step1Status === 'success' && step2Status === 'success';

  return (
    <div className="mt-6 p-5 rounded-2xl bg-white/[0.03] border border-amber-500/20 backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-4">
        <Settings size={16} className="text-amber-400" />
        <span className="text-sm font-semibold text-amber-400">Admin: Link Contracts</span>
      </div>

      <p className="text-xs text-zinc-400 mb-4">
        One-time setup to connect AegisVault and AegisVesting so fees route correctly.
        You must be the contract deployer/owner.
      </p>

      <div className="flex flex-col gap-3">
        {/* Step 1 */}
        <div className="flex items-center gap-3">
          <button
            onClick={linkVaultToVesting}
            disabled={step1Status === 'loading' || step1Status === 'success'}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all
              ${step1Status === 'success'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : step1Status === 'loading'
                  ? 'bg-white/5 text-zinc-400 border border-white/10 cursor-wait'
                  : 'bg-white/5 text-zinc-200 border border-white/10 hover:bg-white/10 hover:border-amber-500/30 cursor-pointer'
              }
            `}
          >
            {step1Status === 'loading' && <Loader2 size={14} className="animate-spin" />}
            {step1Status === 'success' && <CheckCircle size={14} />}
            {step1Status === 'idle' && <Link size={14} />}
            {step1Status === 'error' && <AlertCircle size={14} className="text-red-400" />}
            Step 1: Authorize Vesting on Vault
          </button>
          {step1Error && <span className="text-xs text-red-400">{step1Error}</span>}
        </div>

        {/* Step 2 */}
        <div className="flex items-center gap-3">
          <button
            onClick={linkVestingToVault}
            disabled={step2Status === 'loading' || step2Status === 'success'}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all
              ${step2Status === 'success'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : step2Status === 'loading'
                  ? 'bg-white/5 text-zinc-400 border border-white/10 cursor-wait'
                  : 'bg-white/5 text-zinc-200 border border-white/10 hover:bg-white/10 hover:border-amber-500/30 cursor-pointer'
              }
            `}
          >
            {step2Status === 'loading' && <Loader2 size={14} className="animate-spin" />}
            {step2Status === 'success' && <CheckCircle size={14} />}
            {step2Status === 'idle' && <Link size={14} />}
            {step2Status === 'error' && <AlertCircle size={14} className="text-red-400" />}
            Step 2: Set Vault Address on Vesting
          </button>
          {step2Error && <span className="text-xs text-red-400">{step2Error}</span>}
        </div>
      </div>

      {bothDone && (
        <p className="mt-4 text-xs text-emerald-400 font-medium">
          Contracts linked successfully. Lock creation will now route fees to the vault.
        </p>
      )}
    </div>
  );
}
