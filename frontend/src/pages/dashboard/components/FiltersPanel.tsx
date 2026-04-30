import { RefreshCw } from 'lucide-react';
import { MONTHS, YEARS } from '../mockData';

interface FiltersPanelProps {
  year: number;
  month: number | null;
  onYearChange: (y: number) => void;
  onMonthChange: (m: number | null) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export default function FiltersPanel({ year, month, onYearChange, onMonthChange, onRefresh, isRefreshing }: FiltersPanelProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-wrap items-center gap-4">
      {/* Year */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400 font-medium mr-1">Year</span>
        <div className="flex gap-1">
          {YEARS.map(y => (
            <button
              key={y}
              onClick={() => { onYearChange(y); onMonthChange(null); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                year === y
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-violet-50 hover:text-violet-600'
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      <div className="w-px h-6 bg-gray-200" />

      {/* Month */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="text-xs text-gray-400 font-medium mr-1">Month</span>
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => onMonthChange(null)}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
              month === null
                ? 'bg-violet-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-violet-50 hover:text-violet-600'
            }`}
          >
            All
          </button>
          {MONTHS.map((m, i) => (
            <button
              key={m}
              onClick={() => onMonthChange(i)}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                month === i
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-violet-50 hover:text-violet-600'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="w-px h-6 bg-gray-200" />

      {/* Refresh */}
      <button
        onClick={onRefresh}
        disabled={isRefreshing}
        className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-violet-600 bg-violet-50 hover:bg-violet-100 rounded-xl transition-colors disabled:opacity-60"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
        Refresh
      </button>
    </div>
  );
}
