/**
 * ============================================================================
 * AEGIS VESTING — Token Vesting & Launchpad Contract for Aegis Protocol
 * ============================================================================
 *
 * Enables developers to lock OP_20 tokens with enforceable vesting schedules.
 * Supports LINEAR and CLIFF vesting modes. Charges a 1% fee on all locked
 * tokens and routes them to the AegisVault revenue contract.
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
    StoredU256,
    StoredAddress,
    encodeSelector,
    SafeMath,
    TransferHelper,
} from '@btc-vision/btc-runtime/runtime';

import { u256 } from '@btc-vision/as-bignum/assembly';
import { u256To30Bytes } from '@btc-vision/btc-runtime/runtime/math/abi';
import { EMPTY_POINTER } from '@btc-vision/btc-runtime/runtime/math/bytes';
import {
    ADDRESS_BYTE_LENGTH,
    SELECTOR_BYTE_LENGTH,
    U256_BYTE_LENGTH,
} from '@btc-vision/btc-runtime/runtime/utils';

// ─── Storage Pointers (auto-allocated) ──────────────────────────────────────
const ownerPointer: u16 = Blockchain.nextPointer;
const vaultAddressPointer: u16 = Blockchain.nextPointer;
const lockCounterPointer: u16 = Blockchain.nextPointer;
const globalTVLPointer: u16 = Blockchain.nextPointer;
const lockDataBasePointer: u16 = Blockchain.nextPointer;
const tokenTVLPointer: u16 = Blockchain.nextPointer;

// ─── Lock Data Field Offsets ────────────────────────────────────────────────
const FIELD_TOKEN: u32 = 0;
const FIELD_BENEFICIARY: u32 = 1;
const FIELD_TOTAL_AMOUNT: u32 = 2;
const FIELD_CLAIMED: u32 = 3;
const FIELD_START_TIME: u32 = 4;
const FIELD_DURATION: u32 = 5;
const FIELD_CLIFF_DURATION: u32 = 6;
const FIELD_VESTING_MODE: u32 = 7;
const FIELD_CREATOR: u32 = 8;
const FIELD_IS_ACTIVE: u32 = 9;

// ─── Vesting Mode Constants ─────────────────────────────────────────────────
const MODE_LINEAR: u256 = u256.Zero;
const MODE_CLIFF: u256 = u256.One;

// ─── Fee Basis Points ───────────────────────────────────────────────────────
const FEE_BPS: u64 = 100;
const BPS_DENOMINATOR: u64 = 10000;

// ─── Method Selectors ───────────────────────────────────────────────────────
const SELECTOR_LOCK_TOKENS: Selector = encodeSelector('lockTokens(address,address,uint256,uint256,uint256,uint256)');
const SELECTOR_CLAIM: Selector = encodeSelector('claim(uint256)');
const SELECTOR_GET_LOCK_INFO: Selector = encodeSelector('getLockInfo(uint256)');
const SELECTOR_GET_UNLOCKED: Selector = encodeSelector('getUnlockedAmount(uint256)');
const SELECTOR_GET_LOCKED: Selector = encodeSelector('getLockedAmount(uint256)');
const SELECTOR_GET_NEXT_UNLOCK: Selector = encodeSelector('getNextUnlockTime(uint256)');
const SELECTOR_GET_VESTING_PROGRESS: Selector = encodeSelector('getVestingProgress(uint256)');
const SELECTOR_SET_VAULT: Selector = encodeSelector('setVaultAddress(address)');
const SELECTOR_GET_TOKEN_TVL: Selector = encodeSelector('getTokenTVL(address)');
const SELECTOR_GET_GLOBAL_TVL: Selector = encodeSelector('getGlobalTVL()');
const SELECTOR_GET_LOCK_COUNT: Selector = encodeSelector('getLockCount()');

// ─── Vault depositFee selector ──────────────────────────────────────────────
const VAULT_DEPOSIT_FEE_SELECTOR: Selector = encodeSelector('depositFee(address,uint256)');

/**
 * AegisVesting: The Core Vesting Engine
 */
export class AegisVesting extends OP_NET {
    // ─── Storage ─────────────────────────────────────────────────────────
    private owner: StoredAddress = new StoredAddress(ownerPointer);
    private vaultAddress: StoredAddress = new StoredAddress(vaultAddressPointer);
    private lockCounter: StoredU256 = new StoredU256(lockCounterPointer, EMPTY_POINTER);
    private globalTVL: StoredU256 = new StoredU256(globalTVLPointer, EMPTY_POINTER);
    private tokenTVL: AddressMemoryMap = new AddressMemoryMap(tokenTVLPointer);

    // ─── Lifecycle ──────────────────────────────────────────────────────
    public override onDeployment(_calldata: Calldata): void {
        this.owner.value = Blockchain.tx.sender;
    }

    // ─── Method Router ──────────────────────────────────────────────────
    public override execute(method: Selector, calldata: Calldata): BytesWriter {
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
                return super.execute(method, calldata);
        }
    }

    // ═════════════════════════════════════════════════════════════════════
    //  LOCK CREATION
    // ═════════════════════════════════════════════════════════════════════

    private lockTokens(calldata: Calldata): BytesWriter {
        const token: Address = calldata.readAddress();
        const beneficiary: Address = calldata.readAddress();
        const grossAmount: u256 = calldata.readU256();
        const durationSecs: u256 = calldata.readU256();
        const cliffSecs: u256 = calldata.readU256();
        const vestingMode: u256 = calldata.readU256();

        // ── Input validation ────────────────────────────────────────────
        if (u256.eq(grossAmount, u256.Zero)) {
            throw new Revert('AEGIS: ZERO_AMOUNT');
        }
        if (u256.eq(durationSecs, u256.Zero)) {
            throw new Revert('AEGIS: ZERO_DURATION');
        }
        if (u256.gt(cliffSecs, durationSecs)) {
            throw new Revert('AEGIS: CLIFF_EXCEEDS_DURATION');
        }
        if (!u256.eq(vestingMode, MODE_LINEAR) && !u256.eq(vestingMode, MODE_CLIFF)) {
            throw new Revert('AEGIS: INVALID_VESTING_MODE');
        }

        // ── Calculate fee (1%) and net amount (99%) ─────────────────────
        const feeAmount: u256 = SafeMath.div(
            SafeMath.mul(grossAmount, u256.fromU64(FEE_BPS)),
            u256.fromU64(BPS_DENOMINATOR),
        );
        const netAmount: u256 = SafeMath.sub(grossAmount, feeAmount);

        if (u256.eq(netAmount, u256.Zero)) {
            throw new Revert('AEGIS: NET_AMOUNT_ZERO_AFTER_FEE');
        }

        // ── Transfer gross amount from creator to this contract ─────────
        const creator = Blockchain.tx.sender;
        TransferHelper.transferFrom(token, creator, this.address, grossAmount);

        // ── Route fee to AegisVault ─────────────────────────────────────
        const vaultAddr = this.vaultAddress.value;

        // Transfer fee tokens to vault
        TransferHelper.transfer(token, vaultAddr, feeAmount);

        // Notify vault of the deposit
        this.notifyVaultDeposit(vaultAddr, token, feeAmount);

        // ── Generate new lock ID ────────────────────────────────────────
        const currentCounter: u256 = this.lockCounter.value;
        const lockId: u256 = SafeMath.add(currentCounter, u256.One);
        this.lockCounter.value = lockId;

        // ── Get current timestamp ───────────────────────────────────────
        const now: u256 = u256.fromU64(Blockchain.block.medianTimestamp);

        // ── Store lock data ─────────────────────────────────────────────
        this.setLockFieldAddress(lockId, FIELD_TOKEN, token);
        this.setLockFieldAddress(lockId, FIELD_BENEFICIARY, beneficiary);
        this.setLockField(lockId, FIELD_TOTAL_AMOUNT, netAmount);
        this.setLockField(lockId, FIELD_CLAIMED, u256.Zero);
        this.setLockField(lockId, FIELD_START_TIME, now);
        this.setLockField(lockId, FIELD_DURATION, durationSecs);
        this.setLockField(lockId, FIELD_CLIFF_DURATION, cliffSecs);
        this.setLockField(lockId, FIELD_VESTING_MODE, vestingMode);
        this.setLockFieldAddress(lockId, FIELD_CREATOR, creator);
        this.setLockField(lockId, FIELD_IS_ACTIVE, u256.One);

        // ── Update TVL tracking ─────────────────────────────────────────
        const currentTokenTVL: u256 = this.tokenTVL.get(token);
        this.tokenTVL.set(token, SafeMath.add(currentTokenTVL, netAmount));

        const currentGlobalTVL: u256 = this.globalTVL.value;
        this.globalTVL.value = SafeMath.add(currentGlobalTVL, netAmount);

        // ── Return the new lock ID ──────────────────────────────────────
        const writer = new BytesWriter(32);
        writer.writeU256(lockId);
        return writer;
    }

    // ═════════════════════════════════════════════════════════════════════
    //  CLAIMING VESTED TOKENS
    // ═════════════════════════════════════════════════════════════════════

    private claim(calldata: Calldata): BytesWriter {
        const lockId: u256 = calldata.readU256();

        const isActive = this.getLockField(lockId, FIELD_IS_ACTIVE);
        if (u256.eq(isActive, u256.Zero)) {
            throw new Revert('AEGIS: LOCK_NOT_ACTIVE');
        }

        const beneficiary = this.getLockFieldAsAddress(lockId, FIELD_BENEFICIARY);
        if (Blockchain.tx.sender != beneficiary) {
            throw new Revert('AEGIS: NOT_BENEFICIARY');
        }

        const totalUnlocked = this.calculateUnlocked(lockId);
        const alreadyClaimed = this.getLockField(lockId, FIELD_CLAIMED);
        const claimable = SafeMath.sub(totalUnlocked, alreadyClaimed);

        if (u256.eq(claimable, u256.Zero)) {
            throw new Revert('AEGIS: NOTHING_TO_CLAIM');
        }

        // Update claimed amount BEFORE transfer (CEI pattern)
        const newClaimed = SafeMath.add(alreadyClaimed, claimable);
        this.setLockField(lockId, FIELD_CLAIMED, newClaimed);

        // Check if fully vested → mark inactive
        const totalAmount = this.getLockField(lockId, FIELD_TOTAL_AMOUNT);
        if (u256.eq(newClaimed, totalAmount)) {
            this.setLockField(lockId, FIELD_IS_ACTIVE, u256.Zero);
        }

        // Update TVL
        const token = this.getLockFieldAsAddress(lockId, FIELD_TOKEN);
        const currentTokenTVL = this.tokenTVL.get(token);
        this.tokenTVL.set(token, SafeMath.sub(currentTokenTVL, claimable));

        const currentGlobalTVL: u256 = this.globalTVL.value;
        this.globalTVL.value = SafeMath.sub(currentGlobalTVL, claimable);

        // Transfer tokens to beneficiary
        TransferHelper.transfer(token, beneficiary, claimable);

        const writer = new BytesWriter(32);
        writer.writeU256(claimable);
        return writer;
    }

    // ═════════════════════════════════════════════════════════════════════
    //  VESTING MATH
    // ═════════════════════════════════════════════════════════════════════

    private calculateUnlocked(lockId: u256): u256 {
        const totalAmount = this.getLockField(lockId, FIELD_TOTAL_AMOUNT);
        const startTime = this.getLockField(lockId, FIELD_START_TIME);
        const duration = this.getLockField(lockId, FIELD_DURATION);
        const cliffDuration = this.getLockField(lockId, FIELD_CLIFF_DURATION);
        const vestingMode = this.getLockField(lockId, FIELD_VESTING_MODE);

        const now: u256 = u256.fromU64(Blockchain.block.medianTimestamp);

        if (u256.le(now, startTime)) {
            return u256.Zero;
        }

        const elapsed: u256 = u256.sub(now, startTime);

        // CLIFF MODE
        if (u256.eq(vestingMode, MODE_CLIFF)) {
            if (u256.lt(elapsed, cliffDuration)) {
                return u256.Zero;
            }
            return totalAmount;
        }

        // LINEAR MODE
        if (!u256.eq(cliffDuration, u256.Zero) && u256.lt(elapsed, cliffDuration)) {
            return u256.Zero;
        }

        if (u256.ge(elapsed, duration)) {
            return totalAmount;
        }

        // Proportional unlock: totalAmount * elapsed / duration
        const numerator: u256 = u256.mul(totalAmount, elapsed);
        return u256.div(numerator, duration);
    }

    // ═════════════════════════════════════════════════════════════════════
    //  PUBLIC QUERY METHODS
    // ═════════════════════════════════════════════════════════════════════

    private getUnlockedAmount(calldata: Calldata): BytesWriter {
        const lockId: u256 = calldata.readU256();
        const totalUnlocked = this.calculateUnlocked(lockId);
        const claimed = this.getLockField(lockId, FIELD_CLAIMED);
        const claimable = u256.sub(totalUnlocked, claimed);

        const writer = new BytesWriter(32);
        writer.writeU256(claimable);
        return writer;
    }

    private getLockedAmount(calldata: Calldata): BytesWriter {
        const lockId: u256 = calldata.readU256();
        const totalAmount = this.getLockField(lockId, FIELD_TOTAL_AMOUNT);
        const totalUnlocked = this.calculateUnlocked(lockId);
        const locked = u256.sub(totalAmount, totalUnlocked);

        const writer = new BytesWriter(32);
        writer.writeU256(locked);
        return writer;
    }

    private getNextUnlockTime(calldata: Calldata): BytesWriter {
        const lockId: u256 = calldata.readU256();

        const startTime = this.getLockField(lockId, FIELD_START_TIME);
        const duration = this.getLockField(lockId, FIELD_DURATION);
        const cliffDuration = this.getLockField(lockId, FIELD_CLIFF_DURATION);
        const vestingMode = this.getLockField(lockId, FIELD_VESTING_MODE);
        const isActive = this.getLockField(lockId, FIELD_IS_ACTIVE);

        const writer = new BytesWriter(32);

        if (u256.eq(isActive, u256.Zero)) {
            writer.writeU256(u256.Zero);
            return writer;
        }

        const now: u256 = u256.fromU64(Blockchain.block.medianTimestamp);
        const elapsed: u256 = u256.gt(now, startTime) ? u256.sub(now, startTime) : u256.Zero;
        const vestingEndTime: u256 = u256.add(startTime, duration);

        if (u256.ge(elapsed, duration)) {
            writer.writeU256(u256.Zero);
            return writer;
        }

        if (u256.eq(vestingMode, MODE_CLIFF)) {
            const cliffEnd = u256.add(startTime, cliffDuration);
            if (u256.lt(now, cliffEnd)) {
                writer.writeU256(cliffEnd);
            } else {
                writer.writeU256(u256.Zero);
            }
        } else {
            if (!u256.eq(cliffDuration, u256.Zero) && u256.lt(elapsed, cliffDuration)) {
                writer.writeU256(u256.add(startTime, cliffDuration));
            } else {
                writer.writeU256(vestingEndTime);
            }
        }

        return writer;
    }

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

    private getTokenTVL(calldata: Calldata): BytesWriter {
        const token: Address = calldata.readAddress();
        const tvl = this.tokenTVL.get(token);

        const writer = new BytesWriter(32);
        writer.writeU256(tvl);
        return writer;
    }

    private getGlobalTVL(): BytesWriter {
        const writer = new BytesWriter(32);
        writer.writeU256(this.globalTVL.value);
        return writer;
    }

    private getLockCount(): BytesWriter {
        const writer = new BytesWriter(32);
        writer.writeU256(this.lockCounter.value);
        return writer;
    }

    // ═════════════════════════════════════════════════════════════════════
    //  ADMIN METHODS
    // ═════════════════════════════════════════════════════════════════════

    private setVaultAddress(calldata: Calldata): BytesWriter {
        this.onlyOwner();
        const vault: Address = calldata.readAddress();
        this.vaultAddress.value = vault;

        const writer = new BytesWriter(1);
        writer.writeBoolean(true);
        return writer;
    }

    // ═════════════════════════════════════════════════════════════════════
    //  INTERNAL STORAGE HELPERS
    // ═════════════════════════════════════════════════════════════════════

    /**
     * Computes a sub-pointer for lock field storage.
     * Each lock uses 16 slots: subPointer = lockId * 16 + fieldOffset
     */
    private lockFieldSubPointer(lockId: u256, field: u32): Uint8Array {
        const subKey = u256.add(
            u256.mul(lockId, u256.fromU32(16)),
            u256.fromU32(field),
        );
        return u256To30Bytes(subKey);
    }

    private getLockField(lockId: u256, field: u32): u256 {
        const sub = this.lockFieldSubPointer(lockId, field);
        const stored = new StoredU256(lockDataBasePointer, sub);
        return stored.value;
    }

    private setLockField(lockId: u256, field: u32, value: u256): void {
        const sub = this.lockFieldSubPointer(lockId, field);
        const stored = new StoredU256(lockDataBasePointer, sub);
        stored.value = value;
    }

    private getLockFieldAsAddress(lockId: u256, field: u32): Address {
        const sub = this.lockFieldSubPointer(lockId, field);
        const stored = new StoredU256(lockDataBasePointer, sub);
        const raw = stored.value;
        return Address.fromUint8Array(raw.toUint8Array(true));
    }

    private setLockFieldAddress(lockId: u256, field: u32, addr: Address): void {
        const sub = this.lockFieldSubPointer(lockId, field);
        const stored = new StoredU256(lockDataBasePointer, sub);
        stored.value = u256.fromUint8ArrayBE(addr);
    }

    private onlyOwner(): void {
        const sender = Blockchain.tx.sender;
        const currentOwner = this.owner.value;
        if (sender != currentOwner) {
            throw new Revert('AEGIS: NOT_OWNER');
        }
    }

    // ═════════════════════════════════════════════════════════════════════
    //  CROSS-CONTRACT CALLS
    // ═════════════════════════════════════════════════════════════════════

    /**
     * Notify vault of a fee deposit via depositFee(address,uint256)
     */
    private notifyVaultDeposit(vault: Address, token: Address, amount: u256): void {
        const cd = new BytesWriter(
            SELECTOR_BYTE_LENGTH + ADDRESS_BYTE_LENGTH + U256_BYTE_LENGTH,
        );
        cd.writeSelector(VAULT_DEPOSIT_FEE_SELECTOR);
        cd.writeAddress(token);
        cd.writeU256(amount);

        Blockchain.call(vault, cd);
    }
}
