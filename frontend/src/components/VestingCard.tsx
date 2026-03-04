import { motion } from 'framer-motion';
import { Clock, ArrowDown, ArrowUp, Coins, Tag, User, Calendar } from 'lucide-react';
import { VestingLock, calculateVestingProgress } from '../mock/data';
import ProgressRing from './ProgressRing';
import NeonProgressBar from './NeonProgressBar';

interface VestingCardProps {
  lock: VestingLock;
  index: number;
}

/**
 * Format seconds into human-readable countdown.
 */
function formatDuration(seconds: number): string {
  if (seconds <= 0) return 'Fully Vested';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 30) return `${Math.floor(d / 30)}mo ${d % 30}d`;
  if (d > 0) return `${d}d ${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Format a number with commas and optional abbreviation.
 */
function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

/**
 * Format unix timestamp to readable date.
 */
function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * VestingCard — The main data card for the Vesting Explorer.
 *
 * Renders a glassmorphic card with:
 * - Circular progress ring showing vesting %
 * - Horizontal neon progress bar
 * - Key metrics in a grid
 * - Countdown timer to next unlock
 * - Token and beneficiary info
 */
export default function VestingCard({ lock, index }: VestingCardProps) {
  const progress = calculateVestingProgress(lock);
  const vestingEndDate = lock.startTime + lock.duration;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        delay: index * 0.15,
        duration: 0.7,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="glass-card-strong p-6 hover:bg-white/[0.07] transition-all duration-500 group"
    >
      {/* ── Header: Token info + Status ─────────────────────────── */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-3">
          {/* Token icon placeholder */}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/20 flex items-center justify-center">
            <span className="text-sm font-bold text-emerald-400 font-mono-data">
              {lock.tokenSymbol.slice(0, 2)}
            </span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">{lock.tokenName}</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Tag size={10} className="text-zinc-500" />
              <span className="text-[10px] font-mono-data text-zinc-500">
                {lock.tokenSymbol}
              </span>
              <span className="text-zinc-700 text-[10px]">|</span>
              <span className="text-[10px] font-mono-data text-zinc-500">
                Lock #{lock.lockId}
              </span>
            </div>
          </div>
        </div>

        {/* Status badge */}
        <div className={`
          px-2.5 py-1 rounded-lg text-[10px] font-mono-data uppercase tracking-wider
          ${lock.isActive
            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
          }
        `}>
          {lock.isActive ? 'Active' : 'Completed'}
        </div>
      </div>

      {/* ── Visual Progress Section ─────────────────────────────── */}
      <div className="flex items-center gap-6 mb-6">
        {/* Circular Progress Ring */}
        <div className="flex-shrink-0">
          <ProgressRing
            percent={progress.percentVested}
            size={120}
            strokeWidth={6}
            label="Vested"
            sublabel={lock.vestingMode}
          />
        </div>

        {/* Right side: bar + metrics */}
        <div className="flex-1 space-y-4">
          {/* Neon Progress Bar */}
          <NeonProgressBar percent={progress.percentVested} height={6} />

          {/* Locked vs Vested breakdown */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-emerald-500/10 flex items-center justify-center">
                <ArrowUp size={12} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-[10px] text-zinc-500 uppercase">Vested</p>
                <p className="text-xs font-mono-data text-emerald-400 font-semibold">
                  {formatNumber(progress.unlockedAmount)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-orange-500/10 flex items-center justify-center">
                <ArrowDown size={12} className="text-orange-400" />
              </div>
              <div>
                <p className="text-[10px] text-zinc-500 uppercase">Locked</p>
                <p className="text-xs font-mono-data text-orange-400 font-semibold">
                  {formatNumber(progress.lockedAmount)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Data Grid ───────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <DataCell
          icon={<Coins size={12} />}
          label="Total Locked"
          value={formatNumber(lock.totalAmount)}
        />
        <DataCell
          icon={<ArrowUp size={12} />}
          label="Claimed"
          value={formatNumber(lock.claimedAmount)}
        />
        <DataCell
          icon={<Coins size={12} />}
          label="Claimable Now"
          value={formatNumber(progress.claimableAmount)}
          highlight
        />
      </div>

      {/* ── Countdown & Timeline ────────────────────────────────── */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-zinc-500" />
          <div>
            <p className="text-[10px] text-zinc-500 uppercase">
              {progress.nextUnlockTime ? 'Next Unlock' : 'Status'}
            </p>
            <p className="text-xs font-mono-data text-white font-medium">
              {progress.nextUnlockTime
                ? formatDate(progress.nextUnlockTime)
                : progress.timeRemaining > 0 ? 'Streaming...' : 'Fully Vested'
              }
            </p>
          </div>
        </div>

        <div className="text-right">
          <p className="text-[10px] text-zinc-500 uppercase">Time Remaining</p>
          <motion.p
            className="text-xs font-mono-data text-emerald-400 font-semibold"
            animate={{ opacity: [1, 0.6, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {formatDuration(progress.timeRemaining)}
          </motion.p>
        </div>
      </div>

      {/* ── Footer: Addresses ───────────────────────────────────── */}
      <div className="mt-4 pt-3 border-t border-white/[0.04] flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <User size={10} className="text-zinc-600" />
          <span className="text-[10px] font-mono-data text-zinc-600 truncate max-w-[140px]">
            {lock.beneficiary}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Calendar size={10} className="text-zinc-600" />
          <span className="text-[10px] font-mono-data text-zinc-600">
            {formatDate(lock.startTime)} → {formatDate(vestingEndDate)}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Data Cell sub-component ──────────────────────────────────────── */
function DataCell({
  icon,
  label,
  value,
  highlight = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-zinc-500">{icon}</span>
        <span className="text-[9px] uppercase tracking-wider text-zinc-500">{label}</span>
      </div>
      <p className={`text-sm font-mono-data font-bold ${highlight ? 'text-emerald-400 text-glow-green' : 'text-white'}`}>
        {value}
      </p>
    </div>
  );
}
