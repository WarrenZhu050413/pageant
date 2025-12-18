import { create } from 'zustand';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  action?: {
    label: string;
    onClick: () => void;
  };
  duration?: number; // ms, default 5000
}

interface ToastStore {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],

  addToast: (toast) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const newToast: Toast = { id, ...toast };

    set({ toasts: [...get().toasts, newToast] });

    // Auto-remove after duration
    const duration = toast.duration ?? 5000;
    if (duration > 0) {
      setTimeout(() => {
        get().removeToast(id);
      }, duration);
    }

    return id;
  },

  removeToast: (id) => {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },

  clearToasts: () => {
    set({ toasts: [] });
  },
}));

// Convenience functions for external use
export const toast = {
  success: (message: string, action?: Toast['action']) =>
    useToastStore.getState().addToast({ message, type: 'success', action }),
  error: (message: string, action?: Toast['action']) =>
    useToastStore.getState().addToast({ message, type: 'error', action }),
  info: (message: string, action?: Toast['action']) =>
    useToastStore.getState().addToast({ message, type: 'info', action }),
};
