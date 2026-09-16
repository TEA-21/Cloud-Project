import React from 'react';
import { AlertTriangle, ShieldOff, X } from 'lucide-react';

export default function ConfirmActionDialog({ 
  isOpen, 
  title, 
  message, 
  confirmLabel = 'Confirm', 
  confirmVariant = 'danger',
  onConfirm, 
  onCancel 
}) {
  if (!isOpen) return null;

  const getConfirmButtonClasses = () => {
    switch (confirmVariant) {
      case 'danger':
        return 'bg-rose-600 hover:bg-rose-500 text-white';
      case 'warning':
        return 'bg-amber-600 hover:bg-amber-500 text-white';
      default:
        return 'bg-[#5B58F5] hover:bg-[#4B47E6] text-white';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity" 
        onClick={onCancel}
      />

      {/* Modal Dialog */}
      <div className="relative bg-white border border-gray-200 rounded-xl max-w-md w-full p-6 shadow-panel z-10">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900 font-sans">
              {title}
            </h3>
            <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
              {message}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-2 text-xs font-medium text-gray-700 hover:text-gray-900 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors shadow-xs ${getConfirmButtonClasses()}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
