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
 * Patch a JSONRpcProvider to bypass the broken undici-based fetcher.
 * Overrides _send() entirely with a clean native fetch() implementation.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function patchProviderForBrowser(provider: any): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  provider._send = async (payload: any) => {
    const url: string = provider.url;
    const method = payload?.method ?? 'unknown';
    const controller = new AbortController();
    const timeout = provider.timeout ?? 20000;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!resp.ok) {
        const body = await resp.text().catch(() => '');
        throw new Error(`RPC[${method}] HTTP ${resp.status}: ${body.slice(0, 200)}`);
      }

      const data = await resp.json();
      return [data];
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') {
        throw new Error(`RPC[${method}] timed out after ${timeout}ms`);
      }
      throw e;
    } finally {
      clearTimeout(timeoutId);
    }
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
