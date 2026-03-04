import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rocket, ChevronRight, Check, Lock, Clock, Zap, AlertTriangle } from 'lucide-react';

type Step = 1 | 2 | 3;

const DURATION_OPTIONS = [
  { label: '3 Months', value: 90, desc: '~90 days linear vesting' },
  { label: '6 Months', value: 180, desc: '~180 days linear vesting' },
  { label: '12 Months', value: 365, desc: '~365 days linear vesting' },
  { label: '24 Months', value: 730, desc: '~730 days linear vesting' },
];

/**
 * VaultCreator — The 3-step Launchpad form for locking tokens.
 *
 * Step 1: Select Token (input token address)
 * Step 2: Configure Vesting (duration, mode, beneficiary)
 * Step 3: Review & Execute Lock
 */
export default function VaultCreator() {
  const [step, setStep] = useState<Step>(1);
  const [tokenAddress, setTokenAddress] = useState('');
  const [beneficiary, setBeneficiary] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedDuration, setSelectedDuration] = useState(180);
  const [vestingMode, setVestingMode] = useState<'LINEAR' | 'CLIFF'>('LINEAR');
  const [isExecuting, setIsExecuting] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const canProceedStep1 = tokenAddress.length > 10;
  const canProceedStep2 = beneficiary.length > 10 && Number(amount) > 0;
  const feeAmount = Number(amount) * 0.01;
  const netAmount = Number(amount) - feeAmount;

  function handleExecute() {
    setIsExecuting(true);
    // Simulate transaction
    setTimeout(() => {
      setIsExecuting(false);
      setIsDone(true);
    }, 2500);
  }

  function handleReset() {
    setStep(1);
    setTokenAddress('');
    setBeneficiary('');
    setAmount('');
    setSelectedDuration(180);
    setVestingMode('LINEAR');
    setIsDone(false);
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* ── Step Indicators ─────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <motion.div
              className={`
                w-8 h-8 rounded-full flex items-center justify-center text-xs font-mono-data font-bold
                transition-all duration-300
                ${step >= s
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-neon-green'
                  : 'bg-white/[0.03] text-zinc-600 border border-white/5'
                }
              `}
              animate={step === s ? { scale: [1, 1.1, 1] } : {}}
              transition={{ duration: 0.3 }}
            >
              {step > s ? <Check size={14} /> : s}
            </motion.div>
            {s < 3 && (
              <div className={`w-12 h-px ${step > s ? 'bg-emerald-500/30' : 'bg-white/5'} transition-colors duration-300`} />
            )}
          </div>
        ))}
      </div>

      {/* ── Step Content ────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {!isDone ? (
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 30, filter: 'blur(6px)' }}
            animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, x: -30, filter: 'blur(6px)' }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            {step === 1 && (
              <div className="glass-card-strong p-8">
                <div className="flex items-center gap-2 mb-6">
                  <Lock size={16} className="text-emerald-400" />
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
                    Step 1 — Select Token
                  </h2>
                </div>

                <label className="block mb-2">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-mono-data">
                    OP_20 Token Address
                  </span>
                </label>
                <input
                  type="text"
                  value={tokenAddress}
                  onChange={(e) => setTokenAddress(e.target.value)}
                  placeholder="bc1q_your_token_address..."
                  className="
                    w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3
                    text-sm font-mono-data text-white placeholder-zinc-700
                    focus:border-emerald-500/30 focus:shadow-neon-green focus:outline-none
                    transition-all duration-300
                  "
                />
                <p className="text-[10px] text-zinc-600 mt-2 font-mono-data">
                  Enter the OP_20 token contract address you want to lock
                </p>

                <motion.button
                  onClick={() => setStep(2)}
                  disabled={!canProceedStep1}
                  className={`
                    btn-neon mt-6 w-full flex items-center justify-center gap-2 py-3 rounded-xl
                    text-sm font-semibold transition-all duration-300
                    ${canProceedStep1
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 cursor-pointer'
                      : 'bg-white/[0.03] text-zinc-600 border border-white/5 cursor-not-allowed'
                    }
                  `}
                  whileTap={canProceedStep1 ? { scale: 0.98 } : {}}
                >
                  Continue
                  <ChevronRight size={14} />
                </motion.button>
              </div>
            )}

            {step === 2 && (
              <div className="glass-card-strong p-8">
                <div className="flex items-center gap-2 mb-6">
                  <Clock size={16} className="text-emerald-400" />
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
                    Step 2 — Configure Vesting
                  </h2>
                </div>

                {/* Beneficiary */}
                <label className="block mb-2">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-mono-data">
                    Beneficiary Address
                  </span>
                </label>
                <input
                  type="text"
                  value={beneficiary}
                  onChange={(e) => setBeneficiary(e.target.value)}
                  placeholder="bc1q_beneficiary_address..."
                  className="
                    w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3
                    text-sm font-mono-data text-white placeholder-zinc-700
                    focus:border-emerald-500/30 focus:shadow-neon-green focus:outline-none
                    transition-all duration-300 mb-4
                  "
                />

                {/* Amount */}
                <label className="block mb-2">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-mono-data">
                    Token Amount
                  </span>
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="1,000,000"
                  className="
                    w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3
                    text-sm font-mono-data text-white placeholder-zinc-700
                    focus:border-emerald-500/30 focus:shadow-neon-green focus:outline-none
                    transition-all duration-300 mb-5
                  "
                />

                {/* Vesting Mode */}
                <div className="mb-5">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-mono-data block mb-2">
                    Vesting Mode
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {(['LINEAR', 'CLIFF'] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setVestingMode(mode)}
                        className={`
                          p-3 rounded-xl text-xs font-mono-data uppercase tracking-wider
                          transition-all duration-200 cursor-pointer
                          ${vestingMode === mode
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-neon-green'
                            : 'bg-white/[0.03] text-zinc-500 border border-white/5 hover:bg-white/[0.05]'
                          }
                        `}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Duration */}
                <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-mono-data block mb-2">
                  Vesting Duration
                </span>
                <div className="grid grid-cols-2 gap-2 mb-6">
                  {DURATION_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setSelectedDuration(opt.value)}
                      className={`
                        p-3 rounded-xl text-left transition-all duration-200 cursor-pointer
                        ${selectedDuration === opt.value
                          ? 'bg-emerald-500/15 border border-emerald-500/30'
                          : 'bg-white/[0.03] border border-white/5 hover:bg-white/[0.05]'
                        }
                      `}
                    >
                      <p className={`text-xs font-semibold ${selectedDuration === opt.value ? 'text-emerald-400' : 'text-zinc-300'}`}>
                        {opt.label}
                      </p>
                      <p className="text-[10px] text-zinc-600 font-mono-data">{opt.desc}</p>
                    </button>
                  ))}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setStep(1)}
                    className="px-5 py-3 rounded-xl text-sm text-zinc-500 bg-white/[0.03] border border-white/5 hover:bg-white/[0.05] transition-all cursor-pointer"
                  >
                    Back
                  </button>
                  <motion.button
                    onClick={() => setStep(3)}
                    disabled={!canProceedStep2}
                    className={`
                      btn-neon flex-1 flex items-center justify-center gap-2 py-3 rounded-xl
                      text-sm font-semibold transition-all duration-300
                      ${canProceedStep2
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 cursor-pointer'
                        : 'bg-white/[0.03] text-zinc-600 border border-white/5 cursor-not-allowed'
                      }
                    `}
                    whileTap={canProceedStep2 ? { scale: 0.98 } : {}}
                  >
                    Review Lock
                    <ChevronRight size={14} />
                  </motion.button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="glass-card-strong p-8">
                <div className="flex items-center gap-2 mb-6">
                  <Zap size={16} className="text-emerald-400" />
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
                    Step 3 — Review & Execute
                  </h2>
                </div>

                {/* Summary */}
                <div className="space-y-3 mb-6">
                  <SummaryRow label="Token" value={`${tokenAddress.slice(0, 12)}...${tokenAddress.slice(-6)}`} />
                  <SummaryRow label="Beneficiary" value={`${beneficiary.slice(0, 12)}...${beneficiary.slice(-6)}`} />
                  <SummaryRow label="Gross Amount" value={Number(amount).toLocaleString()} />
                  <SummaryRow label="Mode" value={vestingMode} />
                  <SummaryRow label="Duration" value={`${selectedDuration} days`} />

                  <div className="h-px bg-white/5 my-3" />

                  {/* Fee breakdown */}
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-orange-500/5 border border-orange-500/10">
                    <AlertTriangle size={14} className="text-orange-400" />
                    <div className="flex-1">
                      <p className="text-[10px] text-orange-400 font-mono-data uppercase">
                        1% Protocol Fee
                      </p>
                      <p className="text-xs font-mono-data text-orange-300 font-bold">
                        {feeAmount.toLocaleString()} tokens → Aegis Vault
                      </p>
                    </div>
                  </div>

                  <SummaryRow label="Net Lock Amount" value={netAmount.toLocaleString()} highlight />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setStep(2)}
                    className="px-5 py-3 rounded-xl text-sm text-zinc-500 bg-white/[0.03] border border-white/5 hover:bg-white/[0.05] transition-all cursor-pointer"
                  >
                    Back
                  </button>
                  <motion.button
                    onClick={handleExecute}
                    disabled={isExecuting}
                    className="
                      btn-neon flex-1 flex items-center justify-center gap-2 py-3 rounded-xl
                      text-sm font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30
                      hover:bg-emerald-500/30 transition-all duration-300 cursor-pointer
                      disabled:opacity-50 disabled:cursor-not-allowed
                    "
                    whileTap={{ scale: 0.98 }}
                  >
                    {isExecuting ? (
                      <>
                        <motion.div
                          className="w-4 h-4 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        />
                        Executing...
                      </>
                    ) : (
                      <>
                        <Rocket size={14} />
                        Execute Lock
                      </>
                    )}
                  </motion.button>
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          /* ── Success State ──────────────────────────────────── */
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card-strong p-12 text-center"
          >
            <motion.div
              className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4 shadow-neon-green-lg"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', bounce: 0.5, delay: 0.2 }}
            >
              <Check size={28} className="text-emerald-400" />
            </motion.div>
            <h3 className="text-lg font-bold text-white mb-1">Lock Created Successfully</h3>
            <p className="text-sm text-zinc-500 font-mono-data mb-6">
              {netAmount.toLocaleString()} tokens locked for {selectedDuration} days
            </p>
            <button
              onClick={handleReset}
              className="px-6 py-2.5 rounded-xl text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all cursor-pointer"
            >
              Create Another Lock
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Summary Row ──────────────────────────────────────────────────── */
function SummaryRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-mono-data">{label}</span>
      <span className={`text-sm font-mono-data font-semibold ${highlight ? 'text-emerald-400 text-glow-green' : 'text-white'}`}>
        {value}
      </span>
    </div>
  );
}
