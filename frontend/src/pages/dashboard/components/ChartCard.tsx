interface ChartCardProps {
  title: string;
  subtitle?: string;
  badge?: { label: string; color?: string };
  children: React.ReactNode;
  className?: string;
}

export default function ChartCard({ title, subtitle, badge, children, className = '' }: ChartCardProps) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden ${className}`}>
      <div className="px-5 pt-5 pb-3 flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        {badge && (
          <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${badge.color || 'bg-violet-100 text-violet-700'}`}>
            {badge.label}
          </span>
        )}
      </div>
      <div className="px-2 pb-4">{children}</div>
    </div>
  );
}
