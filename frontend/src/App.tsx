import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, BarChart3, Rocket, ChevronRight } from 'lucide-react';
import Header from './components/Header';
import StatsBar from './components/StatsBar';
import VestingExplorer from './components/VestingExplorer';
import VaultCreator from './components/VaultCreator';
import AdminSetup from './components/AdminSetup';

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

          {/* Admin Setup (only shows when wallet connected) */}
          <motion.div variants={fadeSlideUp}>
            <AdminSetup />
          </motion.div>

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

/* ── Footer ───────────────────────────────────────────────────────── */
function Footer() {
  return (
    <div className="mt-16 mb-8 flex items-center justify-center gap-2 text-zinc-600 text-xs font-mono-data">
      <Shield size={12} />
      <span>AEGIS PROTOCOL</span>
      <ChevronRight size={10} />
      <span>OP_NET TRUST LAYER</span>
      <ChevronRight size={10} />
      <span>VIBECODE HACKATHON 2026</span>
    </div>
  );
}
