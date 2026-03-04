/**
 * ============================================================================
 * AEGIS VESTING — Token Vesting & Launchpad Contract for Aegis Protocol
 * ============================================================================
 *
 * Purpose: Enables developers to lock OP_20 tokens with enforceable vesting
 * schedules. Supports both LINEAR and CLIFF vesting modes. Charges a 1% fee
 * on all locked tokens and routes them to the AegisVault revenue contract.
 *
 * Vesting Modes:
 *   LINEAR — Tokens unlock continuously and proportionally over the duration.
 *            At any point t: unlocked = totalAmount * (elapsed / duration)
 *
 *   CLIFF  — No tokens unlock until the cliff period ends, then 100% unlocks.
 *            Before cliff:  unlocked = 0
 *            After cliff:   unlocked = totalAmount
 *
 * Storage Layout:
 *   Pointer 0x0000 — Owner address
 *   Pointer 0x0001 — AegisVault contract address (fee recipient)
 *   Pointer 0x0002 — Global lock counter (auto-incrementing lock ID)
 *   Pointer 0x0003 — Total Value Locked across all tokens (u256)
 *   Pointer 0x1000 — Lock data base pointer (lockId -> LockInfo fields)
 *   Pointer 0x2000 — User lock index: (user, token) -> lockId
 *   Pointer 0x3000 — Token TVL map: token address -> total locked for that token
 *
 * Fee: 1% of locked amount is deducted and routed to AegisVault on lock creation.
 *      The remaining 99% is the actual vesting amount.
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
const VAULT_ADDRESS_POINTER: u16 = 0x0001;
const LOCK_COUNTER_POINTER: u16 = 0x0002;
const GLOBAL_TVL_POINTER: u16 = 0x0003;
const LOCK_DATA_BASE: u16 = 0x1000;
const USER_LOCK_INDEX_BASE: u16 = 0x2000;
const TOKEN_TVL_BASE: u16 = 0x3000;

// ─── Lock Data Field Offsets ────────────────────────────────────────────────
// Each lock occupies 10 storage slots starting from (LOCK_DATA_BASE + lockId * 16)
const FIELD_TOKEN: u8 = 0;          // Token address being vested
const FIELD_BENEFICIARY: u8 = 1;    // Who receives tokens on unlock
const FIELD_TOTAL_AMOUNT: u8 = 2;   // Total tokens locked (post-fee)
const FIELD_CLAIMED: u8 = 3;        // Tokens already claimed by beneficiary
const FIELD_START_TIME: u8 = 4;     // Timestamp when vesting begins
const FIELD_DURATION: u8 = 5;       // Total vesting duration in seconds
const FIELD_CLIFF_DURATION: u8 = 6; // Cliff period in seconds (0 for linear-only)
const FIELD_VESTING_MODE: u8 = 7;   // 0 = LINEAR, 1 = CLIFF
const FIELD_CREATOR: u8 = 8;        // Who created this lock
const FIELD_IS_ACTIVE: u8 = 9;      // 1 = active, 0 = fully claimed/cancelled

// ─── Vesting Mode Constants ─────────────────────────────────────────────────
const MODE_LINEAR: u256 = u256.Zero;
const MODE_CLIFF: u256 = u256.One;

// ─── Fee Basis Points ───────────────────────────────────────────────────────
// 1% fee = 100 basis points out of 10,000
const FEE_BPS: u64 = 100;
const BPS_DENOMINATOR: u64 = 10000;

// ─── Method Selectors ───────────────────────────────────────────────────────
const SELECTOR_LOCK_TOKENS: u32 = 0xbb01;          // lockTokens(...)
const SELECTOR_CLAIM: u32 = 0xbb02;                // claim(uint256 lockId)
const SELECTOR_GET_LOCK_INFO: u32 = 0xbb03;        // getLockInfo(uint256 lockId)
const SELECTOR_GET_UNLOCKED: u32 = 0xbb04;         // getUnlockedAmount(uint256 lockId)
const SELECTOR_GET_LOCKED: u32 = 0xbb05;           // getLockedAmount(uint256 lockId)
const SELECTOR_GET_NEXT_UNLOCK: u32 = 0xbb06;      // getNextUnlockTime(uint256 lockId)
const SELECTOR_GET_VESTING_PROGRESS: u32 = 0xbb07; // getVestingProgress(uint256 lockId)
const SELECTOR_SET_VAULT: u32 = 0xbb08;            // setVaultAddress(address)
const SELECTOR_GET_TOKEN_TVL: u32 = 0xbb09;        // getTokenTVL(address)
const SELECTOR_GET_GLOBAL_TVL: u32 = 0xbb0a;       // getGlobalTVL()
const SELECTOR_GET_LOCK_COUNT: u32 = 0xbb0b;       // getLockCount()

/**
 * AegisVesting: The Core Vesting Engine
 *
 * Flow:
 * 1. Creator calls lockTokens() with token, beneficiary, amount, duration, mode
 * 2. Contract deducts 1% fee -> sends to AegisVault
 * 3. Remaining 99% is locked under a new vesting schedule
 * 4. Beneficiary calls claim() periodically to withdraw vested tokens
 * 5. Anyone can query vesting state via getUnlockedAmount / getLockedAmount
 */
export class AegisVesting extends OP_NET {

    // ─── Storage Maps ───────────────────────────────────────────────────
    private tokenTVL: AddressMemoryMap<Address, u256>;

    constructor() {
        super();
        this.tokenTVL = new AddressMemoryMap<Address, u256>(TOKEN_TVL_BASE, u256.Zero);
    }

    // ─── Lifecycle ──────────────────────────────────────────────────────
    public override onDeployment(_calldata: Calldata): void {
        const owner = Blockchain.tx.sender;
        Blockchain.setStorageAt(OWNER_POINTER, u256.Zero, addressToU256(owner));

        // Initialize lock counter to 0
        Blockchain.setStorageAt(LOCK_COUNTER_POINTER, u256.Zero, u256.Zero);

        // Initialize global TVL to 0
        Blockchain.setStorageAt(GLOBAL_TVL_POINTER, u256.Zero, u256.Zero);
    }

    // ─── Method Router ──────────────────────────────────────────────────
    public override callMethod(method: Selector, calldata: Calldata): BytesWriter {
        switch (method) {
            case SELECTOR_LOCK_TOKENS:
                return this.lockTokens(calldata);
            case SELECTOR_CLAIM:
                return this.claim(calldata);
            case SELECTOR_GET_LOCK_INFO:
                return this.getLockInfo(calldata);
            case SELECTOR_GET_UNLOCKED:
                return this.getUnlockedAmount(calldata);
            case SELECTOR_GET_LOCKED:
                return this.getLockedAmount(calldata);
            case SELECTOR_GET_NEXT_UNLOCK:
                return this.getNextUnlockTime(calldata);
            case SELECTOR_GET_VESTING_PROGRESS:
                return this.getVestingProgress(calldata);
            case SELECTOR_SET_VAULT:
                return this.setVaultAddress(calldata);
            case SELECTOR_GET_TOKEN_TVL:
                return this.getTokenTVL(calldata);
            case SELECTOR_GET_GLOBAL_TVL:
                return this.getGlobalTVL();
            case SELECTOR_GET_LOCK_COUNT:
                return this.getLockCount();
            default:
                return super.callMethod(method, calldata);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  LOCK CREATION
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * lockTokens — Create a new vesting lock.
     *
     * @param calldata:
     *   [0] address  token          — OP_20 token to lock
     *   [1] address  beneficiary    — Who will receive vested tokens
     *   [2] uint256  amount         — Total tokens to lock (before 1% fee)
     *   [3] uint256  durationSecs   — Vesting duration in seconds
     *   [4] uint256  cliffSecs      — Cliff period in seconds (0 for pure linear)
     *   [5] uint256  vestingMode    — 0 = LINEAR, 1 = CLIFF
     *
     * @returns BytesWriter with the new lock ID (u256)
     *
     * Logic:
     *   1. Validate all inputs
     *   2. Calculate 1% fee and net lock amount
     *   3. Transfer fee to AegisVault via depositFee()
     *   4. Transfer net amount from creator to this contract
     *   5. Store the vesting schedule
     *   6. Return the lock ID
     */
    private lockTokens(calldata: Calldata): BytesWriter {
        // ── Parse calldata ─────────────────────────────────────────────
        const token: Address = calldata.readAddress();
        const beneficiary: Address = calldata.readAddress();
        const grossAmount: u256 = calldata.readU256();
        const durationSecs: u256 = calldata.readU256();
        const cliffSecs: u256 = calldata.readU256();
        const vestingMode: u256 = calldata.readU256();

        // ── Input validation ───────────────────────────────────────────
        if (u256.eq(grossAmount, u256.Zero)) {
            Revert('AEGIS: ZERO_AMOUNT');
        }
        if (u256.eq(durationSecs, u256.Zero)) {
            Revert('AEGIS: ZERO_DURATION');
        }
        // Cliff cannot exceed total duration
        if (u256.gt(cliffSecs, durationSecs)) {
            Revert('AEGIS: CLIFF_EXCEEDS_DURATION');
        }
        // Vesting mode must be 0 (LINEAR) or 1 (CLIFF)
        if (!u256.eq(vestingMode, MODE_LINEAR) && !u256.eq(vestingMode, MODE_CLIFF)) {
            Revert('AEGIS: INVALID_VESTING_MODE');
        }

        // ── Calculate fee (1%) and net amount (99%) ────────────────────
        // fee = grossAmount * 100 / 10000
        const feeAmount: u256 = u256.div(
            u256.mul(grossAmount, u256.fromU64(FEE_BPS)),
            u256.fromU64(BPS_DENOMINATOR)
        );
        // netAmount = grossAmount - fee
        const netAmount: u256 = u256.sub(grossAmount, feeAmount);

        if (u256.eq(netAmount, u256.Zero)) {
            Revert('AEGIS: NET_AMOUNT_ZERO_AFTER_FEE');
        }

        // ── Transfer gross amount from creator to this contract ────────
        // The creator must have approved this contract to spend `grossAmount`
        const creator = Blockchain.tx.sender;
        this.transferTokensFrom(token, creator, Blockchain.contractAddress, grossAmount);

        // ── Route fee to AegisVault ────────────────────────────────────
        const vaultAddr = u256ToAddress(
            Blockchain.getStorageAt(VAULT_ADDRESS_POINTER, u256.Zero)
        );
        // Transfer fee tokens to vault
        this.transferTokens(token, vaultAddr, feeAmount);
        // Notify vault of the deposit (calls vault.depositFee)
        this.notifyVaultDeposit(vaultAddr, token, feeAmount);

        // ── Generate new lock ID ───────────────────────────────────────
        const currentCounter: u256 = Blockchain.getStorageAt(LOCK_COUNTER_POINTER, u256.Zero);
        const lockId: u256 = u256.add(currentCounter, u256.One);
        Blockchain.setStorageAt(LOCK_COUNTER_POINTER, u256.Zero, lockId);

        // ── Get current block timestamp ────────────────────────────────
        const now: u256 = u256.fromU64(Blockchain.block.timestamp);

        // ── Store lock data ────────────────────────────────────────────
        this.setLockField(lockId, FIELD_TOKEN, addressToU256(token));
        this.setLockField(lockId, FIELD_BENEFICIARY, addressToU256(beneficiary));
        this.setLockField(lockId, FIELD_TOTAL_AMOUNT, netAmount);
        this.setLockField(lockId, FIELD_CLAIMED, u256.Zero);
        this.setLockField(lockId, FIELD_START_TIME, now);
        this.setLockField(lockId, FIELD_DURATION, durationSecs);
        this.setLockField(lockId, FIELD_CLIFF_DURATION, cliffSecs);
        this.setLockField(lockId, FIELD_VESTING_MODE, vestingMode);
        this.setLockField(lockId, FIELD_CREATOR, addressToU256(creator));
        this.setLockField(lockId, FIELD_IS_ACTIVE, u256.One);

        // ── Update TVL tracking ────────────────────────────────────────
        // Per-token TVL
        const currentTokenTVL: u256 = this.tokenTVL.get(token);
        this.tokenTVL.set(token, SafeAdd(currentTokenTVL, netAmount));

        // Global TVL
        const globalTVL: u256 = Blockchain.getStorageAt(GLOBAL_TVL_POINTER, u256.Zero);
        Blockchain.setStorageAt(GLOBAL_TVL_POINTER, u256.Zero, SafeAdd(globalTVL, netAmount));

        // ── Return the new lock ID ─────────────────────────────────────
        const writer = new BytesWriter(32);
        writer.writeU256(lockId);
        return writer;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  CLAIMING VESTED TOKENS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * claim — Beneficiary claims their vested (unlocked) tokens.
     *
     * @param calldata [uint256 lockId]
     * @returns BytesWriter with u256 amount claimed
     *
     * Logic:
     *   1. Verify caller is the beneficiary
     *   2. Calculate total unlocked amount
     *   3. Subtract already-claimed amount to get claimable
     *   4. Transfer claimable tokens to beneficiary
     *   5. Update claimed counter
     */
    private claim(calldata: Calldata): BytesWriter {
        const lockId: u256 = calldata.readU256();

        // ── Verify lock exists and is active ───────────────────────────
        const isActive = this.getLockField(lockId, FIELD_IS_ACTIVE);
        if (u256.eq(isActive, u256.Zero)) {
            Revert('AEGIS: LOCK_NOT_ACTIVE');
        }

        // ── Verify caller is beneficiary ───────────────────────────────
        const beneficiary = u256ToAddress(this.getLockField(lockId, FIELD_BENEFICIARY));
        if (Blockchain.tx.sender !== beneficiary) {
            Revert('AEGIS: NOT_BENEFICIARY');
        }

        // ── Calculate claimable amount ─────────────────────────────────
        const totalUnlocked = this.calculateUnlocked(lockId);
        const alreadyClaimed = this.getLockField(lockId, FIELD_CLAIMED);
        const claimable = u256.sub(totalUnlocked, alreadyClaimed);

        if (u256.eq(claimable, u256.Zero)) {
            Revert('AEGIS: NOTHING_TO_CLAIM');
        }

        // ── Update claimed amount BEFORE transfer (CEI pattern) ────────
        const newClaimed = SafeAdd(alreadyClaimed, claimable);
        this.setLockField(lockId, FIELD_CLAIMED, newClaimed);

        // ── Check if fully vested → mark inactive ──────────────────────
        const totalAmount = this.getLockField(lockId, FIELD_TOTAL_AMOUNT);
        if (u256.eq(newClaimed, totalAmount)) {
            this.setLockField(lockId, FIELD_IS_ACTIVE, u256.Zero);
        }

        // ── Update TVL (decrease by claimed amount) ────────────────────
        const token = u256ToAddress(this.getLockField(lockId, FIELD_TOKEN));
        const currentTokenTVL = this.tokenTVL.get(token);
        this.tokenTVL.set(token, u256.sub(currentTokenTVL, claimable));

        const globalTVL = Blockchain.getStorageAt(GLOBAL_TVL_POINTER, u256.Zero);
        Blockchain.setStorageAt(GLOBAL_TVL_POINTER, u256.Zero, u256.sub(globalTVL, claimable));

        // ── Transfer tokens to beneficiary ─────────────────────────────
        this.transferTokens(token, beneficiary, claimable);

        // ── Return claimed amount ──────────────────────────────────────
        const writer = new BytesWriter(32);
        writer.writeU256(claimable);
        return writer;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  VESTING MATH — The core timestamp calculations
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * calculateUnlocked — Core vesting math engine.
     *
     * Determines how many tokens have unlocked based on:
     *   - Current timestamp vs. start time
     *   - Vesting mode (LINEAR vs CLIFF)
     *   - Duration and cliff period
     *
     * LINEAR MODE:
     *   unlocked = totalAmount * min(elapsed, duration) / duration
     *   If cliff is set, unlocked = 0 until cliff passes.
     *
     * CLIFF MODE:
     *   unlocked = 0           if elapsed < cliffDuration
     *   unlocked = totalAmount  if elapsed >= cliffDuration
     */
    private calculateUnlocked(lockId: u256): u256 {
        const totalAmount = this.getLockField(lockId, FIELD_TOTAL_AMOUNT);
        const startTime = this.getLockField(lockId, FIELD_START_TIME);
        const duration = this.getLockField(lockId, FIELD_DURATION);
        const cliffDuration = this.getLockField(lockId, FIELD_CLIFF_DURATION);
        const vestingMode = this.getLockField(lockId, FIELD_VESTING_MODE);

        const now: u256 = u256.fromU64(Blockchain.block.timestamp);

        // ── If current time is before start, nothing unlocked ──────────
        if (u256.le(now, startTime)) {
            return u256.Zero;
        }

        // ── Calculate elapsed time since vesting start ─────────────────
        const elapsed: u256 = u256.sub(now, startTime);

        // ── CLIFF MODE ─────────────────────────────────────────────────
        if (u256.eq(vestingMode, MODE_CLIFF)) {
            // Before cliff: nothing unlocked
            if (u256.lt(elapsed, cliffDuration)) {
                return u256.Zero;
            }
            // After cliff: everything unlocked
            return totalAmount;
        }

        // ── LINEAR MODE ────────────────────────────────────────────────
        // Check cliff gate first (linear can also have a cliff)
        if (!u256.eq(cliffDuration, u256.Zero) && u256.lt(elapsed, cliffDuration)) {
            return u256.Zero;
        }

        // If elapsed >= duration, fully vested
        if (u256.ge(elapsed, duration)) {
            return totalAmount;
        }

        // Proportional unlock: totalAmount * elapsed / duration
        // Using safe multiplication that won't overflow for reasonable token amounts
        const numerator: u256 = u256.mul(totalAmount, elapsed);
        const unlocked: u256 = u256.div(numerator, duration);

        return unlocked;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  PUBLIC QUERY METHODS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * getUnlockedAmount — How many tokens have vested and are available to claim.
     *
     * Returns the NET unlocked amount (total unlocked - already claimed).
     * This is what the beneficiary can claim RIGHT NOW.
     */
    private getUnlockedAmount(calldata: Calldata): BytesWriter {
        const lockId: u256 = calldata.readU256();
        const totalUnlocked = this.calculateUnlocked(lockId);
        const claimed = this.getLockField(lockId, FIELD_CLAIMED);

        // Claimable = total unlocked - already claimed
        const claimable = u256.sub(totalUnlocked, claimed);

        const writer = new BytesWriter(32);
        writer.writeU256(claimable);
        return writer;
    }

    /**
     * getLockedAmount — How many tokens are still locked (not yet vested).
     *
     * locked = totalAmount - totalUnlocked
     */
    private getLockedAmount(calldata: Calldata): BytesWriter {
        const lockId: u256 = calldata.readU256();
        const totalAmount = this.getLockField(lockId, FIELD_TOTAL_AMOUNT);
        const totalUnlocked = this.calculateUnlocked(lockId);

        const locked = u256.sub(totalAmount, totalUnlocked);

        const writer = new BytesWriter(32);
        writer.writeU256(locked);
        return writer;
    }

    /**
     * getNextUnlockTime — Timestamp of the next meaningful unlock event.
     *
     * LINEAR: Returns current timestamp (tokens unlock continuously)
     *         Unless cliff hasn't passed, then returns cliff end time.
     *
     * CLIFF:  Returns the cliff end time if not yet reached.
     *         Returns 0 if cliff has passed (everything is unlocked).
     */
    private getNextUnlockTime(calldata: Calldata): BytesWriter {
        const lockId: u256 = calldata.readU256();

        const startTime = this.getLockField(lockId, FIELD_START_TIME);
        const duration = this.getLockField(lockId, FIELD_DURATION);
        const cliffDuration = this.getLockField(lockId, FIELD_CLIFF_DURATION);
        const vestingMode = this.getLockField(lockId, FIELD_VESTING_MODE);
        const isActive = this.getLockField(lockId, FIELD_IS_ACTIVE);

        const writer = new BytesWriter(32);

        // If lock is inactive (fully claimed), no next unlock
        if (u256.eq(isActive, u256.Zero)) {
            writer.writeU256(u256.Zero);
            return writer;
        }

        const now: u256 = u256.fromU64(Blockchain.block.timestamp);
        const elapsed: u256 = u256.gt(now, startTime) ? u256.sub(now, startTime) : u256.Zero;
        const vestingEndTime: u256 = u256.add(startTime, duration);

        // If fully vested by time
        if (u256.ge(elapsed, duration)) {
            writer.writeU256(u256.Zero);
            return writer;
        }

        if (u256.eq(vestingMode, MODE_CLIFF)) {
            // CLIFF: next unlock is when the cliff ends
            const cliffEnd = u256.add(startTime, cliffDuration);
            if (u256.lt(now, cliffEnd)) {
                writer.writeU256(cliffEnd);
            } else {
                // Cliff passed — everything already unlocked
                writer.writeU256(u256.Zero);
            }
        } else {
            // LINEAR: if cliff hasn't passed, next unlock is cliff end
            if (!u256.eq(cliffDuration, u256.Zero) && u256.lt(elapsed, cliffDuration)) {
                writer.writeU256(u256.add(startTime, cliffDuration));
            } else {
                // Tokens unlock continuously — return vesting end time as "final unlock"
                writer.writeU256(vestingEndTime);
            }
        }

        return writer;
    }

    /**
     * getVestingProgress — Returns progress data for UI rendering.
     *
     * Returns 5 values packed sequentially:
     *   [0] u256 totalAmount     — Total tokens in this lock
     *   [1] u256 unlockedAmount  — Total tokens vested so far
     *   [2] u256 lockedAmount    — Tokens still locked
     *   [3] u256 claimedAmount   — Tokens already withdrawn
     *   [4] u256 claimableAmount — Available to claim right now
     */
    private getVestingProgress(calldata: Calldata): BytesWriter {
        const lockId: u256 = calldata.readU256();

        const totalAmount = this.getLockField(lockId, FIELD_TOTAL_AMOUNT);
        const totalUnlocked = this.calculateUnlocked(lockId);
        const claimed = this.getLockField(lockId, FIELD_CLAIMED);

        const locked = u256.sub(totalAmount, totalUnlocked);
        const claimable = u256.sub(totalUnlocked, claimed);

        const writer = new BytesWriter(160); // 5 x 32 bytes
        writer.writeU256(totalAmount);
        writer.writeU256(totalUnlocked);
        writer.writeU256(locked);
        writer.writeU256(claimed);
        writer.writeU256(claimable);
        return writer;
    }

    /**
     * getLockInfo — Full lock metadata for the Vesting Explorer UI.
     *
     * Returns all stored fields for a given lock ID.
     * Used by the frontend to render the complete vesting data card.
     */
    private getLockInfo(calldata: Calldata): BytesWriter {
        const lockId: u256 = calldata.readU256();

        const writer = new BytesWriter(320); // 10 x 32 bytes
        writer.writeU256(this.getLockField(lockId, FIELD_TOKEN));
        writer.writeU256(this.getLockField(lockId, FIELD_BENEFICIARY));
        writer.writeU256(this.getLockField(lockId, FIELD_TOTAL_AMOUNT));
        writer.writeU256(this.getLockField(lockId, FIELD_CLAIMED));
        writer.writeU256(this.getLockField(lockId, FIELD_START_TIME));
        writer.writeU256(this.getLockField(lockId, FIELD_DURATION));
        writer.writeU256(this.getLockField(lockId, FIELD_CLIFF_DURATION));
        writer.writeU256(this.getLockField(lockId, FIELD_VESTING_MODE));
        writer.writeU256(this.getLockField(lockId, FIELD_CREATOR));
        writer.writeU256(this.getLockField(lockId, FIELD_IS_ACTIVE));
        return writer;
    }

    /**
     * getTokenTVL — Total Value Locked for a specific token.
     */
    private getTokenTVL(calldata: Calldata): BytesWriter {
        const token: Address = calldata.readAddress();
        const tvl = this.tokenTVL.get(token);

        const writer = new BytesWriter(32);
        writer.writeU256(tvl);
        return writer;
    }

    /**
     * getGlobalTVL — Total Value Locked across ALL tokens.
     */
    private getGlobalTVL(): BytesWriter {
        const tvl = Blockchain.getStorageAt(GLOBAL_TVL_POINTER, u256.Zero);
        const writer = new BytesWriter(32);
        writer.writeU256(tvl);
        return writer;
    }

    /**
     * getLockCount — Total number of locks ever created.
     */
    private getLockCount(): BytesWriter {
        const count = Blockchain.getStorageAt(LOCK_COUNTER_POINTER, u256.Zero);
        const writer = new BytesWriter(32);
        writer.writeU256(count);
        return writer;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  ADMIN METHODS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * setVaultAddress — Set the AegisVault contract address.
     * Must be called after both contracts are deployed.
     */
    private setVaultAddress(calldata: Calldata): BytesWriter {
        this.onlyOwner();
        const vault: Address = calldata.readAddress();
        Blockchain.setStorageAt(VAULT_ADDRESS_POINTER, u256.Zero, addressToU256(vault));

        const writer = new BytesWriter(32);
        writer.writeBoolean(true);
        return writer;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  INTERNAL STORAGE HELPERS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * getLockField — Read a single field from a lock's storage slot.
     *
     * Storage formula: pointer = LOCK_DATA_BASE, subPointer = lockId * 16 + fieldOffset
     * This gives each lock 16 possible fields with unique storage slots.
     */
    private getLockField(lockId: u256, field: u8): u256 {
        const subPointer = u256.add(
            u256.mul(lockId, u256.fromU32(16)),
            u256.fromU32(<u32>field)
        );
        return Blockchain.getStorageAt(LOCK_DATA_BASE, subPointer);
    }

    /**
     * setLockField — Write a single field to a lock's storage slot.
     */
    private setLockField(lockId: u256, field: u8, value: u256): void {
        const subPointer = u256.add(
            u256.mul(lockId, u256.fromU32(16)),
            u256.fromU32(<u32>field)
        );
        Blockchain.setStorageAt(LOCK_DATA_BASE, subPointer, value);
    }

    /**
     * onlyOwner — Access control modifier.
     */
    private onlyOwner(): void {
        const sender = Blockchain.tx.sender;
        const owner = u256ToAddress(
            Blockchain.getStorageAt(OWNER_POINTER, u256.Zero)
        );
        if (sender !== owner) {
            Revert('AEGIS: NOT_OWNER');
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  OP_20 TOKEN INTERACTION HELPERS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * transferTokensFrom — Pull tokens from `from` to `to` using OP_20 transferFrom.
     * Requires prior approval from `from` to this contract.
     */
    private transferTokensFrom(token: Address, from: Address, to: Address, amount: u256): void {
        const callWriter = new BytesWriter(96);
        callWriter.writeAddress(from);
        callWriter.writeAddress(to);
        callWriter.writeU256(amount);
        // Selector for transferFrom(address,address,uint256)
        Blockchain.call(token, callWriter);
    }

    /**
     * transferTokens — Push tokens from this contract to `to` using OP_20 transfer.
     */
    private transferTokens(token: Address, to: Address, amount: u256): void {
        const callWriter = new BytesWriter(64);
        callWriter.writeAddress(to);
        callWriter.writeU256(amount);
        // Selector for transfer(address,uint256)
        Blockchain.call(token, callWriter);
    }

    /**
     * notifyVaultDeposit — Call AegisVault.depositFee() to register the fee.
     */
    private notifyVaultDeposit(vault: Address, token: Address, amount: u256): void {
        const callWriter = new BytesWriter(64);
        callWriter.writeAddress(token);
        callWriter.writeU256(amount);
        Blockchain.call(vault, callWriter);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  MODULE-LEVEL HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/** Pack an Address into u256 for storage. */
function addressToU256(addr: Address): u256 {
    return u256.fromBytes(addr.toBytes());
}

/** Unpack a u256 from storage into an Address. */
function u256ToAddress(val: u256): Address {
    return Address.fromBytes(val.toBytes());
}

/** Overflow-safe u256 addition. */
function SafeAdd(a: u256, b: u256): u256 {
    const result = u256.add(a, b);
    if (u256.lt(result, a)) {
        Revert('AEGIS: OVERFLOW');
    }
    return result;
}
