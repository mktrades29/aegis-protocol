/**
 * ============================================================================
 * AEGIS VAULT — Revenue Vault Contract for Aegis Protocol
 * ============================================================================
 *
 * Purpose: Collects the 1% fee from every token lock executed via AegisVesting.
 * Acts as the protocol treasury. Fees accumulate per-token and can be withdrawn
 * by the contract owner (protocol multisig / DAO).
 *
 * OP_NET Runtime: @btc-vision/btc-runtime
 * ============================================================================
 */

import {
    Address,
    Blockchain,
    BytesWriter,
    Calldata,
    OP_NET,
    Revert,
    Selector,
    AddressMemoryMap,
    StoredAddress,
    encodeSelector,
    SafeMath,
    TransferHelper,
} from '@btc-vision/btc-runtime/runtime';

import { u256 } from '@btc-vision/as-bignum/assembly';

// ─── Storage Pointers (auto-allocated) ──────────────────────────────────────
const ownerPointer: u16 = Blockchain.nextPointer;
const depositorPointer: u16 = Blockchain.nextPointer;
const feeLedgerPointer: u16 = Blockchain.nextPointer;

// ─── Method Selectors ───────────────────────────────────────────────────────
const SELECTOR_DEPOSIT_FEE: Selector = encodeSelector('depositFee(address,uint256)');
const SELECTOR_GET_FEES: Selector = encodeSelector('getAccumulatedFees(address)');
const SELECTOR_WITHDRAW: Selector = encodeSelector('withdrawFees(address,address)');
const SELECTOR_SET_DEPOSITOR: Selector = encodeSelector('setAuthorizedDepositor(address)');
const SELECTOR_GET_DEPOSITOR: Selector = encodeSelector('getAuthorizedDepositor()');
const SELECTOR_GET_OWNER: Selector = encodeSelector('getOwner()');

/**
 * AegisVault: Protocol Revenue Accumulator
 *
 * AegisVesting pushes 1% of every lock here via `depositFee()`.
 * Only the authorized depositor (AegisVesting) can credit fees.
 * Only the owner can withdraw accumulated fees.
 */
export class AegisVault extends OP_NET {
    // ─── Storage ─────────────────────────────────────────────────────────
    private owner: StoredAddress = new StoredAddress(ownerPointer);
    private authorizedDepositor: StoredAddress = new StoredAddress(depositorPointer);
    private feeLedger: AddressMemoryMap = new AddressMemoryMap(feeLedgerPointer);

    // ─── Lifecycle: Called once on first deployment ──────────────────────
    public override onDeployment(_calldata: Calldata): void {
        this.owner.value = Blockchain.tx.sender;
    }

    // ─── Method Router ──────────────────────────────────────────────────
    public override execute(method: Selector, calldata: Calldata): BytesWriter {
        switch (method) {
            case SELECTOR_DEPOSIT_FEE:
                return this.depositFee(calldata);
            case SELECTOR_GET_FEES:
                return this.getAccumulatedFees(calldata);
            case SELECTOR_WITHDRAW:
                return this.withdrawFees(calldata);
            case SELECTOR_SET_DEPOSITOR:
                return this.setAuthorizedDepositor(calldata);
            case SELECTOR_GET_DEPOSITOR:
                return this.getAuthorizedDepositorView();
            case SELECTOR_GET_OWNER:
                return this.getOwner();
            default:
                return super.execute(method, calldata);
        }
    }

    // ═════════════════════════════════════════════════════════════════════
    //  PUBLIC METHODS
    // ═════════════════════════════════════════════════════════════════════

    /**
     * depositFee — Called by AegisVesting to credit fees for a specific token.
     * Access: Only the authorized depositor (AegisVesting contract).
     */
    private depositFee(calldata: Calldata): BytesWriter {
        const sender = Blockchain.tx.sender;
        const depositor = this.authorizedDepositor.value;
        if (sender != depositor) {
            throw new Revert('AEGIS_VAULT: UNAUTHORIZED_DEPOSITOR');
        }

        const token: Address = calldata.readAddress();
        const amount: u256 = calldata.readU256();

        if (u256.eq(amount, u256.Zero)) {
            throw new Revert('AEGIS_VAULT: ZERO_AMOUNT');
        }

        // Accumulate fees
        const currentFees: u256 = this.feeLedger.get(token);
        const newTotal: u256 = SafeMath.add(currentFees, amount);
        this.feeLedger.set(token, newTotal);

        const writer = new BytesWriter(1);
        writer.writeBoolean(true);
        return writer;
    }

    /**
     * getAccumulatedFees — Query total accumulated fees for a token.
     * Access: Public.
     */
    private getAccumulatedFees(calldata: Calldata): BytesWriter {
        const token: Address = calldata.readAddress();
        const fees: u256 = this.feeLedger.get(token);

        const writer = new BytesWriter(32);
        writer.writeU256(fees);
        return writer;
    }

    /**
     * withdrawFees — Owner withdraws accumulated fees for a token.
     * Access: Owner only.
     */
    private withdrawFees(calldata: Calldata): BytesWriter {
        this.onlyOwner();

        const token: Address = calldata.readAddress();
        const recipient: Address = calldata.readAddress();

        const balance: u256 = this.feeLedger.get(token);
        if (u256.eq(balance, u256.Zero)) {
            throw new Revert('AEGIS_VAULT: NO_FEES_TO_WITHDRAW');
        }

        // Zero out balance BEFORE transfer (CEI pattern)
        this.feeLedger.set(token, u256.Zero);

        // Transfer tokens to recipient via OP_20 transfer
        TransferHelper.transfer(token, recipient, balance);

        const writer = new BytesWriter(32);
        writer.writeU256(balance);
        return writer;
    }

    /**
     * setAuthorizedDepositor — Set the AegisVesting contract address.
     * Access: Owner only.
     */
    private setAuthorizedDepositor(calldata: Calldata): BytesWriter {
        this.onlyOwner();

        const newDepositor: Address = calldata.readAddress();
        this.authorizedDepositor.value = newDepositor;

        const writer = new BytesWriter(1);
        writer.writeBoolean(true);
        return writer;
    }

    /**
     * getAuthorizedDepositor — Query the current authorized depositor.
     */
    private getAuthorizedDepositorView(): BytesWriter {
        const writer = new BytesWriter(32);
        writer.writeAddress(this.authorizedDepositor.value);
        return writer;
    }

    /**
     * getOwner — Query the contract owner address.
     */
    private getOwner(): BytesWriter {
        const writer = new BytesWriter(32);
        writer.writeAddress(this.owner.value);
        return writer;
    }

    // ═════════════════════════════════════════════════════════════════════
    //  INTERNAL HELPERS
    // ═════════════════════════════════════════════════════════════════════

    private onlyOwner(): void {
        const sender = Blockchain.tx.sender;
        const currentOwner = this.owner.value;
        if (sender != currentOwner) {
            throw new Revert('AEGIS_VAULT: NOT_OWNER');
        }
    }
}
