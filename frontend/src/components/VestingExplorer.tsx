import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, SlidersHorizontal, Filter } from 'lucide-react';
import { MOCK_LOCKS } from '../mock/data';
import VestingCard from './VestingCard';

type FilterMode = 'all' | 'active' | 'completed';

/**
 * VestingExplorer — The public vesting dashboard.
 *
 * Features a search bar to query by token address/name,
 * filter toggles, and renders VestingCard for each result.
 */
export default function VestingExplorer() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterMode>('all');

  const filteredLocks = useMemo(() => {
    let results = MOCK_LOCKS;

    // Filter by status
    if (filter === 'active') results = results.filter(l => l.isActive);
    if (filter === 'completed') results = results.filter(l => !l.isActive);

    // Search by token name, symbol, or address
    if (search.trim()) {
      const q = search.toLowerCase();
      results = results.filter(l =>
        l.tokenName.toLowerCase().includes(q) ||
        l.tokenSymbol.toLowerCase().includes(q) ||
        l.tokenAddress.toLowerCase().includes(q) ||
        l.beneficiary.toLowerCase().includes(q)
      );
    }

    return results;
  }, [search, filter]);

  return (
    <div>
      {/* ── Search Bar ──────────────────────────────────────────── */}
      <motion.div
        className="glass-card-strong p-1.5 mb-6"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 flex-1 px-3">
            <Search size={16} className="text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by token address, name, or symbol..."
              className="
                w-full bg-transparent text-sm text-white placeholder-zinc-600
                font-mono-data py-2.5 outline-none
              "
            />
          </div>

          {/* Filter pills */}
          <div className="flex items-center gap-1 pr-1">
            <FilterPill
              active={filter === 'all'}
              onClick={() => setFilter('all')}
              label="All"
            />
            <FilterPill
              active={filter === 'active'}
              onClick={() => setFilter('active')}
              label="Active"
            />
            <FilterPill
              active={filter === 'completed'}
              onClick={() => setFilter('completed')}
              label="Done"
            />
          </div>
        </div>
      </motion.div>

      {/* ── Results count ───────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-4">
        <SlidersHorizontal size={12} className="text-zinc-600" />
        <span className="text-[10px] uppercase tracking-wider text-zinc-600 font-mono-data">
          {filteredLocks.length} vesting schedule{filteredLocks.length !== 1 ? 's' : ''} found
        </span>
      </div>

      {/* ── Cards Grid ──────────────────────────────────────────── */}
      {filteredLocks.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredLocks.map((lock, i) => (
            <VestingCard key={lock.lockId} lock={lock} index={i} />
          ))}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-card p-12 text-center"
        >
          <Filter size={32} className="text-zinc-700 mx-auto mb-3" />
          <p className="text-sm text-zinc-500">No vesting schedules found</p>
          <p className="text-xs text-zinc-600 mt-1 font-mono-data">
            Try searching by token name or address
          </p>
        </motion.div>
      )}
    </div>
  );
}

/* ── Filter Pill ──────────────────────────────────────────────────── */
function FilterPill({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        px-3 py-1.5 rounded-lg text-[10px] font-mono-data uppercase tracking-wider
        transition-all duration-200 cursor-pointer
        ${active
          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
          : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
        }
      `}
    >
      {label}
    </button>
  );
}
