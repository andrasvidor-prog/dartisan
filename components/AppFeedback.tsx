'use client';

import { useEffect, useRef } from 'react';

export type AppFeedbackState =
  | { kind: 'notice'; message: string }
  | { kind: 'confirm'; message: string; onConfirm: () => void | Promise<void>; confirmLabel?: string };

export function AppFeedback({ feedback, lang, onClose }: {
  feedback: AppFeedbackState | null;
  lang: 'hu' | 'en';
  onClose: () => void;
}) {
  const firstButtonRef = useRef<HTMLButtonElement>(null);
  const lastButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (feedback?.kind !== 'confirm') return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const siblings = Array.from(dialogRef.current?.parentElement?.children || [])
      .filter((element): element is HTMLElement => element instanceof HTMLElement && element !== dialogRef.current)
      .map(element => ({ element, inert: element.inert, ariaHidden: element.getAttribute('aria-hidden') }));
    siblings.forEach(({ element }) => { element.inert = true; element.setAttribute('aria-hidden', 'true'); });
    firstButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onCloseRef.current(); }
      if (event.key === 'Tab' && event.shiftKey && document.activeElement === firstButtonRef.current) {
        event.preventDefault(); lastButtonRef.current?.focus();
      } else if (event.key === 'Tab' && !event.shiftKey && document.activeElement === lastButtonRef.current) {
        event.preventDefault(); firstButtonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      siblings.forEach(({ element, inert, ariaHidden }) => {
        element.inert = inert;
        if (ariaHidden === null) element.removeAttribute('aria-hidden');
        else element.setAttribute('aria-hidden', ariaHidden);
      });
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [feedback]);

  if (!feedback) return null;

  if (feedback.kind === 'notice') return (
    <div role="alert" className="fixed left-4 right-4 bottom-[calc(1rem+var(--app-safe-bottom))] z-[1000] mx-auto max-w-lg rounded-2xl border border-cyan-500/40 bg-[#15202a] px-4 py-3 text-slate-100 shadow-2xl flex items-start gap-4">
      <p className="flex-1 text-sm font-semibold leading-snug">{feedback.message}</p>
      <button type="button" onClick={onClose} aria-label={lang === 'hu' ? 'Üzenet bezárása' : 'Dismiss message'} className="shrink-0 min-h-10 px-2 text-cyan-300 font-bold">×</button>
    </div>
  );

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={lang === 'hu' ? 'Megerősítés' : 'Confirmation'} className="fixed inset-0 z-[1000] bg-black/80 p-4 flex items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-[#151a22] p-6 shadow-2xl">
        <p className="text-base font-semibold text-slate-100 leading-relaxed">{feedback.message}</p>
        <div className="grid grid-cols-2 gap-3 mt-6">
          <button ref={firstButtonRef} type="button" onClick={onClose} className="min-h-12 rounded-xl bg-slate-800 text-white font-black">{lang === 'hu' ? 'Mégse' : 'Cancel'}</button>
          <button ref={lastButtonRef} type="button" onClick={() => { onClose(); void feedback.onConfirm(); }} className="min-h-12 rounded-xl bg-rose-500 text-white font-black">{feedback.confirmLabel || (lang === 'hu' ? 'Megerősítés' : 'Confirm')}</button>
        </div>
      </div>
    </div>
  );
}
