export default function LoadingSpinner({ size = 'md', text }: { size?: 'sm' | 'md' | 'lg'; text?: string }) {
  const s = { sm: 'w-5 h-5', md: 'w-8 h-8', lg: 'w-12 h-12' }[size];
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <div className={`spinner ${s}`} />
      {text && <p className="text-sm text-gray-500">{text}</p>}
    </div>
  );
}
