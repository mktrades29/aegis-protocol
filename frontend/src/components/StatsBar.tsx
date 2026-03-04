import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Layers, Coins, TrendingUp } from 'lucide-react';
import { MOCK_STATS } from '../mock/data';

/**
 * AnimatedCounter — Numbers visibly count up from 0.
 * Uses requestAnimationFrame for smooth 60fps animation.
 */
function AnimatedCounter({ target, duration = 2000, prefix = '', suffix = '' }: {
  target: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
}) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    let raf: number;

    function tick() {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic for satisfying deceleration
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.floor(target * eased));

      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      }
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return (
    <span className="font-mono-data">
      {prefix}{current.toLocaleString()}{suffix}
    </span>
  );
}

const stats = [
  {
    label: 'Total Value Locked',
    value: MOCK_STATS.totalValueLocked,
    icon: Lock,
    color: 'emerald',
    prefix: '',
    suffix: '',
  },
  {
    label: 'Active Locks',
    value: MOCK_STATS.totalLocks,
    icon: Layers,
    color: 'emerald',
    prefix: '',
    suffix: '',
  },
  {
    label: 'Tokens Tracked',
    value: MOCK_STATS.totalTokensTracked,
    icon: TrendingUp,
    color: 'emerald',
    prefix: '',
    suffix: '',
  },
  {
    label: 'Vault Fees Collected',
    value: MOCK_STATS.vaultFeesCollected,
    icon: Coins,
    color: 'orange',
    prefix: '',
    suffix: '',
  },
];

export default function StatsBar() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.4 + i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="glass-card p-4 group hover:bg-white/[0.06] transition-all duration-300"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className={`
              w-7 h-7 rounded-lg flex items-center justify-center
              ${stat.color === 'orange'
                ? 'bg-orange-500/10 text-orange-400'
                : 'bg-emerald-500/10 text-emerald-400'
              }
            `}>
              <stat.icon size={14} />
            </div>
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
              {stat.label}
            </span>
          </div>
          <div className={`
            text-xl font-bold
            ${stat.color === 'orange' ? 'text-orange-400' : 'text-white'}
          `}>
            <AnimatedCounter
              target={stat.value}
              prefix={stat.prefix}
              suffix={stat.suffix}
              duration={2000 + i * 300}
            />
          </div>
        </motion.div>
      ))}
    </div>
  );
}
