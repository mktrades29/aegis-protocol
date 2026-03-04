import { motion } from 'framer-motion';

interface NeonProgressBarProps {
  percent: number;
  height?: number;
  color?: 'green' | 'orange';
  showLabel?: boolean;
}

/**
 * NeonProgressBar — Highly stylized horizontal progress bar with neon glow.
 *
 * Features:
 * - Smooth width animation via Framer Motion
 * - Glowing edge on the fill bar
 * - Background track with subtle pattern
 * - Animated shine sweep effect
 */
export default function NeonProgressBar({
  percent,
  height = 8,
  color = 'green',
  showLabel = true,
}: NeonProgressBarProps) {
  const colors = {
    green: {
      fill: 'from-emerald-500 to-emerald-400',
      glow: 'shadow-[0_0_12px_rgba(34,197,94,0.6)]',
      text: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
    },
    orange: {
      fill: 'from-orange-500 to-amber-400',
      glow: 'shadow-[0_0_12px_rgba(249,115,22,0.6)]',
      text: 'text-orange-400',
      bg: 'bg-orange-500/10',
    },
  };

  const c = colors[color];

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex justify-between items-center mb-2">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">Progress</span>
          <span className={`text-xs font-mono-data font-bold ${c.text}`}>
            {percent.toFixed(1)}%
          </span>
        </div>
      )}

      {/* Track */}
      <div
        className={`relative w-full rounded-full overflow-hidden ${c.bg}`}
        style={{ height }}
      >
        {/* Fill */}
        <motion.div
          className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${c.fill} ${c.glow}`}
          initial={{ width: '0%' }}
          animate={{ width: `${Math.min(percent, 100)}%` }}
          transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1], delay: 0.5 }}
        >
          {/* Animated shine sweep */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 3, ease: 'easeInOut' }}
          />
        </motion.div>
      </div>
    </div>
  );
}
