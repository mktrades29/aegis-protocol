/**
 * Singleton RPC provider for read-only contract calls.
 *
 * The opnet JSONRpcProvider uses a Node.js undici Agent internally which
 * breaks in browsers. We monkey-patch the fetcher to use native fetch().
 */
import { JSONRpcProvider } from 'opnet';
import { networks } from '@btc-vision/bitcoin';
import { config } from '../config/env';

const networkMap: Record<string, typeof networks.regtest> = {
  regtest: networks.regtest,
  testnet: networks.testnet,
  mainnet: networks.bitcoin,
};

/**
 * Patch a JSONRpcProvider so it uses the browser's native fetch()
 * instead of the undici-based fetcher that breaks in browsers.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function patchProviderForBrowser(provider: any): void {
  provider._fetcherWithCleanup = {
    fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, init),
    close: async () => {},
  };
}

let cachedProvider: JSONRpcProvider | null = null;

export function getProvider(): JSONRpcProvider {
  if (!cachedProvider) {
    const network = networkMap[config.network] ?? networks.regtest;
    cachedProvider = new JSONRpcProvider({ url: config.rpcUrl, network });
    patchProviderForBrowser(cachedProvider);
  }
  return cachedProvider;
}

export function getNetwork() {
  return networkMap[config.network] ?? networks.regtest;
}
