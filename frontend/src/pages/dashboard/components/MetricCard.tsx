import { TrendingUp, TrendingDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string;
  sub?: string;
  trend?: number;
  icon: LucideIcon;
  iconBg?: string;
  iconColor?: string;
  borderColor?: string;
}

export default function MetricCard({ label, value, sub, trend, icon: Icon, iconBg = 'bg-violet-100', iconColor = 'text-violet-600', borderColor = 'border-violet-500' }: MetricCardProps) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 border-l-4 ${borderColor} p-5 flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${trend >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
            {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div>
        <div className="text-2xl font-bold text-gray-900 leading-tight">{value}</div>
        <div className="text-xs text-gray-500 uppercase tracking-wide font-medium mt-0.5">{label}</div>
        {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
      </div>
    </div>
  );
}
