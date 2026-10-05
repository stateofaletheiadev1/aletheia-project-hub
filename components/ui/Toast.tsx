'use client';

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, Info, X } from 'lucide-react';

type ToastTone = 'success' | 'info';

interface ToastMessage {
  id: number;
  title: string;
  body?: string;
  tone: ToastTone;
}

interface ToastApi {
  notify: (title: string, body?: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/** Replaces blocking window.alert() with accessible, non-modal notices. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((all) => all.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback<ToastApi['notify']>(
    (title, body, tone = 'success') => {
      const id = ++nextId.current;
      setToasts((all) => [...all.slice(-2), { id, title, body, tone }]);
      window.setTimeout(() => dismiss(id), 6000);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] flex flex-col gap-3 w-[min(92vw,420px)]"
      >
        {toasts.map((t) => {
          const Icon = t.tone === 'success' ? CheckCircle2 : Info;
          return (
            <div
              key={t.id}
              className="animate-toast-in relative overflow-hidden bg-navy-deep/95 backdrop-blur-xl border border-gold/35 rounded-sm shadow-elevated text-parchment p-4 pr-10 flex gap-3"
            >
              <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-gold to-transparent" />
              <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${t.tone === 'success' ? 'text-laurel-light' : 'text-gold'}`} />
              <div className="space-y-1 min-w-0">
                <p className="text-sm font-bold">{t.title}</p>
                {t.body && <p className="text-xs text-parchment/65 leading-relaxed">{t.body}</p>}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="absolute top-3 right-3 text-parchment/40 hover:text-gold transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}
