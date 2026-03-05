/**
 * Contract ABI definitions for AegisVesting and AegisVault.
 * Follows the OP_NET BitcoinInterfaceAbi structure.
 */
import { ABIDataTypes, BitcoinAbiTypes } from 'opnet';
import type { BitcoinInterfaceAbi } from 'opnet';

export const AEGIS_VESTING_ABI: BitcoinInterfaceAbi = [
  // ── Write Methods ──────────────────────────────────────────────
  {
    name: 'lockTokens',
    constant: false,
    inputs: [
      { name: 'token', type: ABIDataTypes.ADDRESS },
      { name: 'beneficiary', type: ABIDataTypes.ADDRESS },
      { name: 'amount', type: ABIDataTypes.UINT256 },
      { name: 'durationSecs', type: ABIDataTypes.UINT256 },
      { name: 'cliffSecs', type: ABIDataTypes.UINT256 },
      { name: 'vestingMode', type: ABIDataTypes.UINT256 },
    ],
    outputs: [{ name: 'lockId', type: ABIDataTypes.UINT256 }],
    type: BitcoinAbiTypes.Function,
  },
  {
    name: 'claim',
    constant: false,
    inputs: [{ name: 'lockId', type: ABIDataTypes.UINT256 }],
    outputs: [{ name: 'amountClaimed', type: ABIDataTypes.UINT256 }],
    type: BitcoinAbiTypes.Function,
  },
  {
    name: 'setVaultAddress',
    constant: false,
    inputs: [{ name: 'vault', type: ABIDataTypes.ADDRESS }],
    outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
    type: BitcoinAbiTypes.Function,
  },

  // ── Read Methods ───────────────────────────────────────────────
  {
    name: 'getLockInfo',
    constant: true,
    inputs: [{ name: 'lockId', type: ABIDataTypes.UINT256 }],
    outputs: [
      { name: 'token', type: ABIDataTypes.ADDRESS },
      { name: 'beneficiary', type: ABIDataTypes.ADDRESS },
      { name: 'totalAmount', type: ABIDataTypes.UINT256 },
      { name: 'claimed', type: ABIDataTypes.UINT256 },
      { name: 'startTime', type: ABIDataTypes.UINT256 },
      { name: 'duration', type: ABIDataTypes.UINT256 },
      { name: 'cliffDuration', type: ABIDataTypes.UINT256 },
      { name: 'vestingMode', type: ABIDataTypes.UINT256 },
      { name: 'creator', type: ABIDataTypes.ADDRESS },
      { name: 'isActive', type: ABIDataTypes.UINT256 },
    ],
    type: BitcoinAbiTypes.Function,
  },
  {
    name: 'getUnlockedAmount',
    constant: true,
    inputs: [{ name: 'lockId', type: ABIDataTypes.UINT256 }],
    outputs: [{ name: 'amount', type: ABIDataTypes.UINT256 }],
    type: BitcoinAbiTypes.Function,
  },
  {
    name: 'getLockedAmount',
    constant: true,
    inputs: [{ name: 'lockId', type: ABIDataTypes.UINT256 }],
    outputs: [{ name: 'amount', type: ABIDataTypes.UINT256 }],
    type: BitcoinAbiTypes.Function,
  },
  {
    name: 'getNextUnlockTime',
    constant: true,
    inputs: [{ name: 'lockId', type: ABIDataTypes.UINT256 }],
    outputs: [{ name: 'timestamp', type: ABIDataTypes.UINT256 }],
    type: BitcoinAbiTypes.Function,
  },
  {
    name: 'getVestingProgress',
    constant: true,
    inputs: [{ name: 'lockId', type: ABIDataTypes.UINT256 }],
    outputs: [
      { name: 'total', type: ABIDataTypes.UINT256 },
      { name: 'unlocked', type: ABIDataTypes.UINT256 },
      { name: 'locked', type: ABIDataTypes.UINT256 },
      { name: 'claimed', type: ABIDataTypes.UINT256 },
      { name: 'claimable', type: ABIDataTypes.UINT256 },
    ],
    type: BitcoinAbiTypes.Function,
  },
  {
    name: 'getTokenTVL',
    constant: true,
    inputs: [{ name: 'token', type: ABIDataTypes.ADDRESS }],
    outputs: [{ name: 'tvl', type: ABIDataTypes.UINT256 }],
    type: BitcoinAbiTypes.Function,
  },
  {
    name: 'getGlobalTVL',
    constant: true,
    inputs: [],
    outputs: [{ name: 'tvl', type: ABIDataTypes.UINT256 }],
    type: BitcoinAbiTypes.Function,
  },
  {
    name: 'getLockCount',
    constant: true,
    inputs: [],
    outputs: [{ name: 'count', type: ABIDataTypes.UINT256 }],
    type: BitcoinAbiTypes.Function,
  },
];

export const AEGIS_VAULT_ABI: BitcoinInterfaceAbi = [
  // ── Write Methods ──────────────────────────────────────────────
  {
    name: 'setAuthorizedDepositor',
    constant: false,
    inputs: [{ name: 'newDepositor', type: ABIDataTypes.ADDRESS }],
    outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
    type: BitcoinAbiTypes.Function,
  },
  // ── Read Methods ───────────────────────────────────────────────
  {
    name: 'getAccumulatedFees',
    constant: true,
    inputs: [{ name: 'token', type: ABIDataTypes.ADDRESS }],
    outputs: [{ name: 'fees', type: ABIDataTypes.UINT256 }],
    type: BitcoinAbiTypes.Function,
  },
  {
    name: 'getAuthorizedDepositor',
    constant: true,
    inputs: [],
    outputs: [{ name: 'depositor', type: ABIDataTypes.UINT256 }],
    type: BitcoinAbiTypes.Function,
  },
  {
    name: 'getOwner',
    constant: true,
    inputs: [],
    outputs: [{ name: 'owner', type: ABIDataTypes.UINT256 }],
    type: BitcoinAbiTypes.Function,
  },
];
