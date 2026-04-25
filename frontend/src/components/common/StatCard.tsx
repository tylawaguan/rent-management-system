import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface Props {
  label: string;
  value: string | number;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  trend?: number;
  sub?: string;
}

export default function StatCard({ label, value, icon: Icon, iconBg, iconColor, trend, sub }: Props) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${iconBg}`}>
        <Icon className={`w-6 h-6 ${iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        {(trend !== undefined || sub) && (
          <div className="flex items-center gap-1 mt-0.5">
            {trend !== undefined && (
              <>
                {trend >= 0
                  ? <TrendingUp className="w-3 h-3 text-green-500" />
                  : <TrendingDown className="w-3 h-3 text-red-500" />}
                <span className={`text-xs font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {Math.abs(trend)}%
                </span>
              </>
            )}
            {sub && <span className="text-xs text-gray-400">{sub}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
