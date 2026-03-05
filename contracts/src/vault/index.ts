import { Blockchain, Revert } from '@btc-vision/btc-runtime/runtime';
import { AegisVault } from './AegisVault';

// Do NOT add any logic here. This is the entry point for the WASM module.
Blockchain.contract = () => {
    return new AegisVault();
};

export * from '@btc-vision/btc-runtime/runtime/exports';

// @ts-ignore
@inline function abort(
    message: string | null,
    fileName: string | null,
    lineNumber: u32,
    columnNumber: u32,
): void {
    throw new Revert(
        `ABORT: ${message || 'unknown'} at ${fileName || 'unknown'}:${lineNumber}:${columnNumber}`,
    );
}
