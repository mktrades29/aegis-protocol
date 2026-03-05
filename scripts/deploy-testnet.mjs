#!/usr/bin/env node
/**
 * deploy.mjs — Deploy AegisVault + AegisVesting to OPNet,
 * then link them together (setAuthorizedDepositor + setVaultAddress).
 *
 * Usage:
 *   MNEMONIC="your 24 words" node scripts/deploy-testnet.mjs [regtest|testnet]
 *
 * Requires: a funded wallet on the target network.
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
const { JSONRpcProvider, getContract, ABIDataTypes, BitcoinAbiTypes } = require('opnet');

// ── Config ───────────────────────────────────────────────────────────
const targetNetwork = process.argv[2] || 'regtest';
const NETWORK_MAP = {
  regtest: { network: networks.regtest, url: 'https://regtest.opnet.org' },
  testnet: { network: networks.opnetTestnet, url: 'https://testnet.opnet.org' },
};

const cfg = NETWORK_MAP[targetNetwork];
if (!cfg) {
  console.error(`Unknown network: ${targetNetwork}. Use "regtest" or "testnet".`);
  process.exit(1);
}

const NETWORK = cfg.network;
const RPC_URL = cfg.url;
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
console.log(`Deployer: ${wallet.p2tr}`);
console.log(`Network:  ${targetNetwork} (${RPC_URL})`);

// ── Provider ─────────────────────────────────────────────────────────
const provider = new JSONRpcProvider({ url: RPC_URL, network: NETWORK });
const factory = new TransactionFactory();

// ── Helpers ──────────────────────────────────────────────────────────
async function deploy(wasmPath, label) {
  console.log(`\n--- Deploying ${label} ---`);
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

  console.log(`  Contract: ${deployment.contractAddress}`);

  const fundingResult = await provider.sendRawTransaction(deployment.transaction[0]);
  console.log(`  Funding TX: ${fundingResult.txid}`);

  const revealResult = await provider.sendRawTransaction(deployment.transaction[1]);
  console.log(`  Reveal TX:  ${revealResult.txid}`);

  return deployment.contractAddress;
}

async function waitForBlock(label) {
  console.log(`  Waiting for next block (${label})...`);
  const startBlock = Number(await provider.getBlockNumber());
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 10_000));
    const current = Number(await provider.getBlockNumber());
    if (current > startBlock) {
      console.log(`  Confirmed at block ${current}`);
      return;
    }
    process.stdout.write('.');
  }
  console.log('\n  Timed out waiting. You may need to run the link step manually.');
}

async function linkContracts(vaultAddr, vestingAddr) {
  console.log('\n--- Linking Contracts ---');

  const VAULT_ABI = [{
    name: 'setAuthorizedDepositor', constant: false,
    inputs: [{ name: 'newDepositor', type: ABIDataTypes.ADDRESS }],
    outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
    type: BitcoinAbiTypes.Function,
  }];
  const VESTING_ABI = [{
    name: 'setVaultAddress', constant: false,
    inputs: [{ name: 'vault', type: ABIDataTypes.ADDRESS }],
    outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
    type: BitcoinAbiTypes.Function,
  }];

  // Step 1: Vault.setAuthorizedDepositor(Vesting)
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

  await waitForBlock('setAuthorizedDepositor');

  // Step 2: Vesting.setVaultAddress(Vault)
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
  console.log('\n=== Aegis Protocol Deployment ===\n');

  // Check balance
  const utxos = await provider.utxoManager.getUTXOs({ address: wallet.p2tr });
  if (utxos.length === 0) {
    console.error(`\nNo UTXOs found for ${wallet.p2tr}`);
    console.error(`Fund this address first:`);
    console.error(`  Regtest faucet: https://faucet.opnet.org/`);
    console.error(`  Address: ${wallet.p2tr}`);
    process.exit(1);
  }
  const totalSats = utxos.reduce((sum, u) => sum + BigInt(u.value), 0n);
  console.log(`Balance: ${utxos.length} UTXOs, ${totalSats} sats\n`);

  // Deploy Vault
  const vaultAddr = await deploy(VAULT_WASM, 'AegisVault');
  await waitForBlock('AegisVault deployment');

  // Deploy Vesting
  const vestingAddr = await deploy(VESTING_WASM, 'AegisVesting');
  await waitForBlock('AegisVesting deployment');

  // Link them
  await linkContracts(vaultAddr, vestingAddr);

  // Write .env
  const rpcUrl = targetNetwork === 'regtest' ? 'https://regtest.opnet.org' : 'https://testnet.opnet.org';
  const envContent = [
    `VITE_OPNET_RPC_URL=${rpcUrl}`,
    `VITE_NETWORK=${targetNetwork}`,
    `VITE_AEGIS_VESTING_ADDRESS=${vestingAddr}`,
    `VITE_AEGIS_VAULT_ADDRESS=${vaultAddr}`,
    '',
  ].join('\n');

  const envPath = resolve(__dirname, '../frontend/.env');
  writeFileSync(envPath, envContent);

  console.log('\n=== DEPLOYMENT COMPLETE ===');
  console.log(`Network:  ${targetNetwork}`);
  console.log(`Vault:    ${vaultAddr}`);
  console.log(`Vesting:  ${vestingAddr}`);
  console.log(`\nfrontend/.env updated.`);
  console.log(`\nNext steps:`);
  console.log(`  1. Set these as Vercel env vars`);
  console.log(`  2. Redeploy: cd frontend && npm run build`);
  console.log(`  3. Push to trigger Vercel rebuild`);
}

main().catch((err) => {
  console.error('\nDeployment failed:', err.message || err);
  process.exit(1);
});
