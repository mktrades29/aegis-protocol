import { motion } from 'framer-motion';
import { Shield, Zap } from 'lucide-react';

export default function Header() {
  return (
    <header className="flex items-center justify-between py-4">
      {/* Logo + Title */}
      <div className="flex items-center gap-3">
        {/* Animated Shield Icon */}
        <motion.div
          className="relative"
          animate={{ rotate: [0, 2, -2, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shadow-neon-green">
            <Shield size={20} className="text-emerald-400" />
          </div>
          {/* Glow dot */}
          <motion.div
            className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400"
            animate={{ opacity: [1, 0.4, 1], scale: [1, 0.8, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </motion.div>

        <div>
          <h1 className="text-lg font-bold tracking-tight text-white">
            AEGIS
            <span className="text-emerald-400 ml-1">PROTOCOL</span>
          </h1>
          <p className="text-[10px] font-mono-data text-zinc-500 tracking-[0.2em] uppercase">
            The OP_NET Trust Layer
          </p>
        </div>
      </div>

      {/* Status Badge */}
      <div className="flex items-center gap-2">
        <motion.div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20"
          animate={{ boxShadow: ['0 0 10px rgba(34,197,94,0.2)', '0 0 20px rgba(34,197,94,0.4)', '0 0 10px rgba(34,197,94,0.2)'] }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          <Zap size={12} className="text-emerald-400" />
          <span className="text-xs font-mono-data text-emerald-400">LIVE</span>
        </motion.div>
      </div>
    </header>
  );
}
