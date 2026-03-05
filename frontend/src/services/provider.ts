/**
 * Singleton RPC provider for read-only contract calls.
 * Used as a fallback when the wallet is not connected.
 */
import { JSONRpcProvider } from 'opnet';
import { networks } from '@btc-vision/bitcoin';
import { config } from '../config/env';

const networkMap: Record<string, typeof networks.regtest> = {
  regtest: networks.regtest,
  testnet: networks.testnet,
  mainnet: networks.bitcoin,
};

let cachedProvider: JSONRpcProvider | null = null;

export function getProvider(): JSONRpcProvider {
  if (!cachedProvider) {
    const network = networkMap[config.network] ?? networks.regtest;
    cachedProvider = new JSONRpcProvider({ url: config.rpcUrl, network });
  }
  return cachedProvider;
}

export function getNetwork() {
  return networkMap[config.network] ?? networks.regtest;
}
