import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, BarChart3, Rocket, ChevronRight, Lock, Zap, Globe, Radio } from 'lucide-react';
import Header from './components/Header';
import StatsBar from './components/StatsBar';
import VestingExplorer from './components/VestingExplorer';
import VaultCreator from './components/VaultCreator';
import { config } from './config/env';

type Tab = 'explorer' | 'launchpad';

const stagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.2 },
  },
};

const fadeSlideUp = {
  hidden: { opacity: 0, y: 30, filter: 'blur(8px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
  },
};

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('explorer');

  return (
    <div className="relative min-h-screen">
      {/* ── Animated Background ──────────────────────────────────── */}
      <div className="animated-bg" />
      <div className="grid-overlay" />

      {/* ── Content ──────────────────────────────────────────────── */}
      <div className="relative z-10">
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="visible"
          className="max-w-6xl mx-auto px-4 sm:px-6 py-6"
        >
          {/* Header */}
          <motion.div variants={fadeSlideUp}>
            <Header />
          </motion.div>

          {/* Hero Section */}
          <motion.div variants={fadeSlideUp}>
            <HeroSection />
          </motion.div>

          {/* Stats Bar */}
          <motion.div variants={fadeSlideUp}>
            <StatsBar />
          </motion.div>

          {/* Tab Navigation */}
          <motion.div variants={fadeSlideUp} className="flex gap-2 mt-8 mb-6">
            <TabButton
              active={activeTab === 'explorer'}
              onClick={() => setActiveTab('explorer')}
              icon={<BarChart3 size={16} />}
              label="Vesting Explorer"
            />
            <TabButton
              active={activeTab === 'launchpad'}
              onClick={() => setActiveTab('launchpad')}
              icon={<Rocket size={16} />}
              label="Vault Creator"
            />
          </motion.div>

          {/* Tab Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -20, filter: 'blur(6px)' }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              {activeTab === 'explorer' ? <VestingExplorer /> : <VaultCreator />}
            </motion.div>
          </AnimatePresence>

          {/* Footer */}
          <motion.div variants={fadeSlideUp}>
            <Footer />
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

/* ── Tab Button ───────────────────────────────────────────────────── */
function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium
        transition-all duration-300 cursor-pointer
        ${active
          ? 'bg-white/10 text-emerald-400 border border-emerald-500/30 shadow-neon-green'
          : 'bg-white/[0.03] text-zinc-400 border border-white/5 hover:bg-white/[0.06] hover:text-zinc-200'
        }
      `}
    >
      {icon}
      {label}
      {active && (
        <motion.div
          layoutId="activeTab"
          className="absolute inset-0 rounded-xl border border-emerald-500/20"
          transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
        />
      )}
    </button>
  );
}

/* ── Hero Section ────────────────────────────────────────────────── */
function HeroSection() {
  return (
    <div className="mt-6 mb-2">
      <div className="glass-card-strong p-8 sm:p-10 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-emerald-500/3 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <div className="px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-[10px] font-mono-data text-emerald-400 uppercase tracking-wider">Bitcoin L1</span>
            </div>
            <div className="px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/[0.06]">
              <span className="text-[10px] font-mono-data text-zinc-400 uppercase tracking-wider">OP_NET</span>
            </div>
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold text-white leading-tight mb-3">
            Institutional-Grade Token Vesting
            <br />
            <span className="text-emerald-400">Directly on Bitcoin.</span>
          </h2>

          <p className="text-sm text-zinc-400 max-w-xl leading-relaxed mb-6">
            Lock any OP_20 token with enforceable linear or cliff vesting schedules.
            Transparent 1% protocol fees route to an on-chain treasury vault.
            All data verifiable on Bitcoin L1.
          </p>

          <div className="flex flex-wrap gap-4">
            <FeaturePill icon={<Lock size={12} />} text="Time-locked vesting" />
            <FeaturePill icon={<Zap size={12} />} text="Linear & cliff modes" />
            <FeaturePill icon={<Globe size={12} />} text="Fully on-chain" />
          </div>
        </div>
      </div>
    </div>
  );
}

function FeaturePill({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
      <span className="text-emerald-400">{icon}</span>
      <span className="text-[11px] text-zinc-400 font-medium">{text}</span>
    </div>
  );
}

/* ── Footer ───────────────────────────────────────────────────────── */
function Footer() {
  const [blockHeight, setBlockHeight] = useState<number | null>(null);
  const networkName = config.network === 'testnet' ? 'OPNet Testnet' : config.network === 'mainnet' ? 'OPNet Mainnet' : 'OPNet Regtest';

  useEffect(() => {
    async function fetchBlock() {
      try {
        const url = config.rpcUrl || 'https://testnet.opnet.org/api/v1/json-rpc';
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'btc_blockNumber', params: [] }),
        });
        const data = await resp.json();
        if (data.result) setBlockHeight(parseInt(data.result, 16));
      } catch { /* silent */ }
    }
    fetchBlock();
  }, []);

  return (
    <div className="mt-16 mb-8 space-y-3">
      {/* Network Status */}
      <div className="flex items-center justify-center gap-3">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
          <motion.div
            className="w-1.5 h-1.5 rounded-full bg-emerald-400"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <Radio size={10} className="text-emerald-400/60" />
          <span className="text-[10px] font-mono-data text-emerald-400/80">{networkName}</span>
          {blockHeight && (
            <>
              <span className="text-emerald-500/30">|</span>
              <span className="text-[10px] font-mono-data text-emerald-400/60">Block #{blockHeight.toLocaleString()}</span>
            </>
          )}
        </div>
      </div>

      {/* Brand footer */}
      <div className="flex items-center justify-center gap-2 text-zinc-600 text-xs font-mono-data">
        <Shield size={12} />
        <span>AEGIS PROTOCOL</span>
        <ChevronRight size={10} />
        <span>OP_NET TRUST LAYER</span>
        <ChevronRight size={10} />
        <span>VIBECODE HACKATHON 2026</span>
      </div>
    </div>
  );
}
