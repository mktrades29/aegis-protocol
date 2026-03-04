import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface ProgressRingProps {
  percent: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
}

/**
 * ProgressRing — Animated circular SVG progress indicator.
 *
 * Features:
 * - Smooth stroke-dashoffset animation via Framer Motion
 * - Neon glow filter on the progress arc
 * - Animated percentage counter in the center
 * - Pulsing glow effect on the ring
 */
export default function ProgressRing({
  percent,
  size = 160,
  strokeWidth = 8,
  label,
  sublabel,
}: ProgressRingProps) {
  const [displayPercent, setDisplayPercent] = useState(0);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  // Animate the center number
  useEffect(() => {
    const duration = 1500;
    const startTime = Date.now();
    let raf: number;

    function tick() {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayPercent(Math.floor(percent * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [percent]);

  return (
    <div className="relative flex flex-col items-center">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Glow filter definition */}
        <defs>
          <filter id="neon-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="ring-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#4ade80" />
          </linearGradient>
        </defs>

        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={strokeWidth}
        />

        {/* Animated progress arc */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#ring-gradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
          filter="url(#neon-glow)"
        />
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold font-mono-data text-white text-glow-green">
          {displayPercent}%
        </span>
        {label && (
          <span className="text-[10px] uppercase tracking-wider text-emerald-400/70 mt-1">
            {label}
          </span>
        )}
        {sublabel && (
          <span className="text-[10px] text-zinc-500 mt-0.5">
            {sublabel}
          </span>
        )}
      </div>
    </div>
  );
}
