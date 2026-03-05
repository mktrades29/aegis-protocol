#!/usr/bin/env node
/**
 * deploy-testnet.mjs — Deploy AegisVault + AegisVesting to OPNet testnet,
 * then link them together (setAuthorizedDepositor + setVaultAddress).
 *
 * Usage:
 *   MNEMONIC="your 24 words" node scripts/deploy-testnet.mjs
 *
 * Requires: a funded testnet wallet (signet BTC).
 * Run from the project root — reads .wasm from contracts/build/.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(resolve(__dirname, '../frontend/package.json'));

const { Mnemonic, TransactionFactory } = require('@btc-vision/transaction');
const { networks } = require('@btc-vision/bitcoin');
const { MLDSASecurityLevel } = require('@btc-vision/bip32');
const { JSONRpcProvider, getContract } = require('opnet');

// ── Config ───────────────────────────────────────────────────────────
const NETWORK = networks.opnetTestnet;
const RPC_URL = 'https://testnet.opnet.org';
const FEE_RATE = 3;
const GAS_SAT_FEE = 10_000n;

const VAULT_WASM = resolve(__dirname, '../contracts/build/AegisVault.wasm');
const VESTING_WASM = resolve(__dirname, '../contracts/build/AegisVesting.wasm');

// ── Wallet ───────────────────────────────────────────────────────────
const phrase = process.env.MNEMONIC;
if (!phrase) {
  console.error('ERROR: Set MNEMONIC env var to your 24-word phrase.');
  process.exit(1);
}

const mnemonic = new Mnemonic(phrase, '', NETWORK, MLDSASecurityLevel.LEVEL2);
const wallet = mnemonic.derive(0);
console.log(`Deployer address: ${wallet.p2tr}`);

// ── Provider ─────────────────────────────────────────────────────────
const provider = new JSONRpcProvider({ url: RPC_URL, network: NETWORK });
const factory = new TransactionFactory();

// ── Helpers ──────────────────────────────────────────────────────────
async function deploy(wasmPath, label) {
  console.log(`\nDeploying ${label}...`);
  const bytecode = readFileSync(wasmPath);
  console.log(`  Bytecode: ${bytecode.length} bytes`);

  const utxos = await provider.utxoManager.getUTXOs({ address: wallet.p2tr });
  if (utxos.length === 0) throw new Error('No UTXOs — fund your wallet first');
  console.log(`  UTXOs: ${utxos.length}`);

  const challenge = await provider.getChallenge();

  const deployment = await factory.signDeployment({
    from: wallet.p2tr,
    utxos,
    signer: wallet.keypair,
    mldsaSigner: wallet.mldsaKeypair,
    network: NETWORK,
    feeRate: FEE_RATE,
    priorityFee: 0n,
    gasSatFee: GAS_SAT_FEE,
    bytecode,
    challenge,
    linkMLDSAPublicKeyToAddress: true,
    revealMLDSAPublicKey: true,
  });

  console.log(`  Contract address: ${deployment.contractAddress}`);

  const fundingResult = await provider.sendRawTransaction(deployment.transaction[0]);
  console.log(`  Funding TX: ${fundingResult.txid}`);

  const revealResult = await provider.sendRawTransaction(deployment.transaction[1]);
  console.log(`  Reveal TX:  ${revealResult.txid}`);

  return deployment.contractAddress;
}

async function waitForConfirmation(label) {
  console.log(`\n  Waiting for ${label} to confirm (checking every 15s)...`);
  const startBlock = Number(await provider.getBlockNumber());
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 15_000));
    const currentBlock = Number(await provider.getBlockNumber());
    if (currentBlock > startBlock) {
      console.log(`  Confirmed at block ${currentBlock}`);
      return;
    }
  }
  console.log('  Timed out waiting — proceed manually if needed.');
}

async function linkContracts(vaultAddr, vestingAddr) {
  console.log('\nLinking contracts...');

  // Import ABIs inline (same shape as frontend/src/config/abis.ts)
  const { ABIDataTypes, BitcoinAbiTypes } = require('opnet');
  const VAULT_ABI = [
    {
      name: 'setAuthorizedDepositor',
      constant: false,
      inputs: [{ name: 'newDepositor', type: ABIDataTypes.ADDRESS }],
      outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
      type: BitcoinAbiTypes.Function,
    },
  ];
  const VESTING_ABI = [
    {
      name: 'setVaultAddress',
      constant: false,
      inputs: [{ name: 'vault', type: ABIDataTypes.ADDRESS }],
      outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
      type: BitcoinAbiTypes.Function,
    },
  ];

  // Step 1: setAuthorizedDepositor on Vault → Vesting
  console.log('  Step 1: Vault.setAuthorizedDepositor(Vesting)');
  const vault = getContract(vaultAddr, VAULT_ABI, provider, NETWORK, wallet.p2tr);
  const r1 = await vault.setAuthorizedDepositor(vestingAddr);
  if (r1.revert) throw new Error(`setAuthorizedDepositor reverted: ${r1.revert}`);
  const tx1 = await r1.sendTransaction({
    signer: wallet.keypair,
    mldsaSigner: wallet.mldsaKeypair,
    maximumAllowedSatToSpend: 100_000n,
    feeRate: FEE_RATE,
    network: NETWORK,
  });
  console.log(`  TX: ${tx1.transactionId}`);

  await waitForConfirmation('setAuthorizedDepositor');

  // Step 2: setVaultAddress on Vesting → Vault
  console.log('  Step 2: Vesting.setVaultAddress(Vault)');
  const vesting = getContract(vestingAddr, VESTING_ABI, provider, NETWORK, wallet.p2tr);
  const r2 = await vesting.setVaultAddress(vaultAddr);
  if (r2.revert) throw new Error(`setVaultAddress reverted: ${r2.revert}`);
  const tx2 = await r2.sendTransaction({
    signer: wallet.keypair,
    mldsaSigner: wallet.mldsaKeypair,
    maximumAllowedSatToSpend: 100_000n,
    feeRate: FEE_RATE,
    network: NETWORK,
  });
  console.log(`  TX: ${tx2.transactionId}`);
}

// ── Main ─────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Aegis Protocol — Testnet Deployment ===\n');

  // Deploy Vault first (it has no constructor dependencies)
  const vaultAddr = await deploy(VAULT_WASM, 'AegisVault');
  await waitForConfirmation('AegisVault deployment');

  // Deploy Vesting
  const vestingAddr = await deploy(VESTING_WASM, 'AegisVesting');
  await waitForConfirmation('AegisVesting deployment');

  // Link them
  await linkContracts(vaultAddr, vestingAddr);

  // Write .env
  const envContent = [
    `VITE_OPNET_RPC_URL=https://testnet.opnet.org`,
    `VITE_NETWORK=testnet`,
    `VITE_AEGIS_VESTING_ADDRESS=${vestingAddr}`,
    `VITE_AEGIS_VAULT_ADDRESS=${vaultAddr}`,
    '',
  ].join('\n');

  const envPath = resolve(__dirname, '../frontend/.env');
  writeFileSync(envPath, envContent);

  console.log('\n=== Deployment Complete ===');
  console.log(`Vault:   ${vaultAddr}`);
  console.log(`Vesting: ${vestingAddr}`);
  console.log(`\nfrontend/.env updated. Run 'npm run dev' to test.`);
}

main().catch((err) => {
  console.error('\nDeployment failed:', err.message || err);
  process.exit(1);
});
