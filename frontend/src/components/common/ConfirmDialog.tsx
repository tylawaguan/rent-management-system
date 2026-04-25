import { AlertTriangle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: 'danger' | 'warning';
  isLoading?: boolean;
}

export default function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Confirm', variant = 'danger', isLoading }: Props) {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay">
      <div className="modal max-w-sm animate-fade-in">
        <div className="modal-body text-center">
          <div className={`w-14 h-14 rounded-full ${variant === 'danger' ? 'bg-red-100' : 'bg-yellow-100'} flex items-center justify-center mx-auto mb-4`}>
            <AlertTriangle className={`w-7 h-7 ${variant === 'danger' ? 'text-red-600' : 'text-yellow-600'}`} />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
          <p className="text-gray-500 text-sm">{message}</p>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={onConfirm} disabled={isLoading} className={variant === 'danger' ? 'btn-danger' : 'btn btn-warning bg-yellow-500 text-white hover:bg-yellow-600'}>
            {isLoading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
