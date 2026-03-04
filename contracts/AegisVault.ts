/**
 * ============================================================================
 * AEGIS VAULT — Revenue Vault Contract for Aegis Protocol
 * ============================================================================
 *
 * Purpose: Collects the 1% fee from every token lock executed via AegisVesting.
 * Acts as the protocol treasury. Fees accumulate per-token and can be withdrawn
 * by the contract owner (protocol multisig / DAO).
 *
 * Storage Layout:
 *   Pointer 0x0000 — Owner address
 *   Pointer 0x0001 — Authorized depositor (AegisVesting contract address)
 *   Pointer 0x1000 — Fee ledger base: maps token address -> accumulated fee (u256)
 *   Pointer 0x2000 — Total unique tokens tracked (u256 counter)
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
} from '@btc-vision/btc-runtime/runtime';

import { u256 } from 'as-bignum/assembly';

// ─── Storage Pointer Constants ──────────────────────────────────────────────
const OWNER_POINTER: u16 = 0x0000;
const DEPOSITOR_POINTER: u16 = 0x0001;
const FEE_LEDGER_POINTER: u16 = 0x1000;
const TOKEN_COUNT_POINTER: u16 = 0x2000;

// ─── Method Selectors ───────────────────────────────────────────────────────
// Each public method has a unique 4-byte selector derived from its signature.
const SELECTOR_DEPOSIT_FEE: u32 = 0xaa01;      // depositFee(address,uint256)
const SELECTOR_GET_FEES: u32 = 0xaa02;          // getAccumulatedFees(address)
const SELECTOR_WITHDRAW: u32 = 0xaa03;          // withdrawFees(address,address)
const SELECTOR_SET_DEPOSITOR: u32 = 0xaa04;     // setAuthorizedDepositor(address)
const SELECTOR_GET_DEPOSITOR: u32 = 0xaa05;     // getAuthorizedDepositor()
const SELECTOR_GET_OWNER: u32 = 0xaa06;         // getOwner()

/**
 * AegisVault: Protocol Revenue Accumulator
 *
 * This contract is intentionally simple — it is a secure fee ledger.
 * AegisVesting pushes 1% of every lock here via `depositFee()`.
 * Only the authorized depositor (AegisVesting) can credit fees.
 * Only the owner can withdraw accumulated fees.
 */
export class AegisVault extends OP_NET {

    // ─── Storage Maps ───────────────────────────────────────────────────
    // Maps token address -> total accumulated fees for that token
    private feeLedger: AddressMemoryMap<Address, u256>;

    constructor() {
        super();
        this.feeLedger = new AddressMemoryMap<Address, u256>(FEE_LEDGER_POINTER, u256.Zero);
    }

    // ─── Lifecycle: Called once on first deployment ─────────────────────
    public override onDeployment(_calldata: Calldata): void {
        // Set deployer as owner
        const owner = Blockchain.tx.sender;
        Blockchain.setStorageAt(OWNER_POINTER, u256.Zero, this.addressToU256(owner));

        // Depositor starts as zero address — must be set after AegisVesting deploys
        Blockchain.setStorageAt(DEPOSITOR_POINTER, u256.Zero, u256.Zero);

        // Initialize token counter
        Blockchain.setStorageAt(TOKEN_COUNT_POINTER, u256.Zero, u256.Zero);
    }

    // ─── Method Router ──────────────────────────────────────────────────
    public override callMethod(method: Selector, calldata: Calldata): BytesWriter {
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
                return this.getAuthorizedDepositor();
            case SELECTOR_GET_OWNER:
                return this.getOwner();
            default:
                return super.callMethod(method, calldata);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  PUBLIC METHODS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * depositFee — Called by AegisVesting to credit fees for a specific token.
     *
     * @param calldata [address token, uint256 amount]
     * @returns BytesWriter with success boolean
     *
     * Access: Only the authorized depositor (AegisVesting contract).
     * This is the ONLY entry point for fee accumulation.
     */
    private depositFee(calldata: Calldata): BytesWriter {
        // ── Guard: Only the authorized depositor can call this ──────────
        const sender = Blockchain.tx.sender;
        const depositor = this.u256ToAddress(
            Blockchain.getStorageAt(DEPOSITOR_POINTER, u256.Zero)
        );
        if (sender !== depositor) {
            Revert('AEGIS_VAULT: UNAUTHORIZED_DEPOSITOR');
        }

        // ── Parse calldata ─────────────────────────────────────────────
        const token: Address = calldata.readAddress();
        const amount: u256 = calldata.readU256();

        // ── Validate amount ────────────────────────────────────────────
        if (u256.eq(amount, u256.Zero)) {
            Revert('AEGIS_VAULT: ZERO_AMOUNT');
        }

        // ── Accumulate fees ────────────────────────────────────────────
        // Read current balance for this token
        const currentFees: u256 = this.feeLedger.get(token);

        // Safe addition: new total = current + incoming amount
        const newTotal: u256 = SafeAdd(currentFees, amount);

        // Write updated balance
        this.feeLedger.set(token, newTotal);

        // ── Return success ─────────────────────────────────────────────
        const writer = new BytesWriter(32);
        writer.writeBoolean(true);
        return writer;
    }

    /**
     * getAccumulatedFees — Query total accumulated fees for a token.
     *
     * @param calldata [address token]
     * @returns BytesWriter with u256 fee amount
     *
     * Access: Public (anyone can query).
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
     *
     * @param calldata [address token, address recipient]
     * @returns BytesWriter with u256 amount withdrawn
     *
     * Access: Owner only.
     * Effect: Resets the fee balance to zero and triggers an OP_20 transfer.
     */
    private withdrawFees(calldata: Calldata): BytesWriter {
        // ── Guard: Owner only ──────────────────────────────────────────
        this.onlyOwner();

        // ── Parse calldata ─────────────────────────────────────────────
        const token: Address = calldata.readAddress();
        const recipient: Address = calldata.readAddress();

        // ── Read and validate balance ──────────────────────────────────
        const balance: u256 = this.feeLedger.get(token);
        if (u256.eq(balance, u256.Zero)) {
            Revert('AEGIS_VAULT: NO_FEES_TO_WITHDRAW');
        }

        // ── Zero out the balance BEFORE transfer (checks-effects-interactions) ─
        this.feeLedger.set(token, u256.Zero);

        // ── Execute OP_20 transfer to recipient ────────────────────────
        // In OP_NET, cross-contract calls use Blockchain.call()
        // This transfers the accumulated fee tokens to the recipient
        const transferCalldata = new BytesWriter(64);
        transferCalldata.writeAddress(recipient);
        transferCalldata.writeU256(balance);
        Blockchain.call(token, transferCalldata);

        // ── Return amount withdrawn ────────────────────────────────────
        const writer = new BytesWriter(32);
        writer.writeU256(balance);
        return writer;
    }

    /**
     * setAuthorizedDepositor — Set the AegisVesting contract address.
     *
     * @param calldata [address newDepositor]
     *
     * Access: Owner only. Called once after AegisVesting is deployed.
     */
    private setAuthorizedDepositor(calldata: Calldata): BytesWriter {
        this.onlyOwner();

        const newDepositor: Address = calldata.readAddress();
        Blockchain.setStorageAt(DEPOSITOR_POINTER, u256.Zero, this.addressToU256(newDepositor));

        const writer = new BytesWriter(32);
        writer.writeBoolean(true);
        return writer;
    }

    /**
     * getAuthorizedDepositor — Query the current authorized depositor address.
     */
    private getAuthorizedDepositor(): BytesWriter {
        const raw = Blockchain.getStorageAt(DEPOSITOR_POINTER, u256.Zero);
        const writer = new BytesWriter(32);
        writer.writeU256(raw);
        return writer;
    }

    /**
     * getOwner — Query the contract owner address.
     */
    private getOwner(): BytesWriter {
        const raw = Blockchain.getStorageAt(OWNER_POINTER, u256.Zero);
        const writer = new BytesWriter(32);
        writer.writeU256(raw);
        return writer;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  INTERNAL HELPERS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * onlyOwner — Reverts if caller is not the contract owner.
     */
    private onlyOwner(): void {
        const sender = Blockchain.tx.sender;
        const owner = this.u256ToAddress(
            Blockchain.getStorageAt(OWNER_POINTER, u256.Zero)
        );
        if (sender !== owner) {
            Revert('AEGIS_VAULT: NOT_OWNER');
        }
    }

    /**
     * addressToU256 — Packs an Address into a u256 for storage.
     * OP_NET addresses are typically 20-byte values that fit within u256.
     */
    private addressToU256(addr: Address): u256 {
        return u256.fromBytes(addr.toBytes());
    }

    /**
     * u256ToAddress — Unpacks a u256 from storage back into an Address.
     */
    private u256ToAddress(val: u256): Address {
        return Address.fromBytes(val.toBytes());
    }
}

// ─── Safe Math ──────────────────────────────────────────────────────────────
/**
 * SafeAdd — Overflow-checked u256 addition.
 * Reverts if result would overflow the 256-bit boundary.
 */
function SafeAdd(a: u256, b: u256): u256 {
    const result = u256.add(a, b);
    if (u256.lt(result, a)) {
        Revert('AEGIS_VAULT: OVERFLOW');
    }
    return result;
}
