import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, CheckCircle2, Copy, ExternalLink, LayoutDashboard, Loader2, X } from 'lucide-react';

interface WebsiteSavedModalProps {
  siteUrl: string;
  returnFocusTo?: HTMLElement | null;
  onClose: () => void;
  onBackToDashboard: () => void;
  /** Phase 5: shown only when the verified completion check reports not-ready. */
  completionNote?: string | null;
}

export const WebsiteSavedModal: React.FC<WebsiteSavedModalProps> = ({
  siteUrl,
  returnFocusTo,
  onClose,
  onBackToDashboard,
  completionNote,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previewRef = useRef<HTMLAnchorElement>(null);
  const [isCopying, setIsCopying] = useState(false);
  const [copyNotice, setCopyNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const previousOverflow = document.body.style.overflow;
    const previousFocus = returnFocusTo || document.activeElement;
    // A native modal traps focus, makes the editor inert, and supports Escape.
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    previewRef.current?.focus();

    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, [returnFocusTo]);

  useEffect(() => {
    if (copyNotice?.type !== 'success') return;
    const timer = window.setTimeout(() => setCopyNotice(null), 3200);
    return () => window.clearTimeout(timer);
  }, [copyNotice]);

  const handleCopyLink = async () => {
    if (isCopying) return;
    setIsCopying(true);
    setCopyNotice(null);

    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(siteUrl);
      setCopyNotice({ type: 'success', message: 'Site link copied to clipboard!' });
    } catch {
      setCopyNotice({
        type: 'error',
        message: 'Couldn’t copy automatically. Select the site link above and copy it manually.',
      });
    } finally {
      setIsCopying(false);
    }
  };

  const copied = copyNotice?.type === 'success';

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="website-saved-title"
      aria-describedby="website-saved-description"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl border border-gray-200 bg-white p-0 text-[#151c27] shadow-2xl backdrop:bg-slate-950/60 backdrop:backdrop-blur-sm"
    >
      <div className="relative p-6 sm:p-8">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close success dialog"
          className="absolute right-4 top-4 rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C20E5A]"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-emerald-700">Save complete</p>
        <h2 id="website-saved-title" className="font-display text-2xl font-bold tracking-tight">
          Website saved successfully!
        </h2>
        <p id="website-saved-description" className="mt-3 text-sm leading-relaxed text-gray-600">
          What’s next? Preview your live website, share the link with clients, or head back to your dashboard.
        </p>

        <div className="my-6 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <label htmlFor="website-saved-link" className="mb-1 block text-xs font-bold text-gray-600">
            Your live website link
          </label>
          <input
            id="website-saved-link"
            type="text"
            readOnly
            value={siteUrl}
            onFocus={(event) => event.currentTarget.select()}
            className="w-full rounded bg-transparent p-1 font-mono text-xs text-gray-700 outline-none focus:ring-2 focus:ring-[#C20E5A]/30"
          />
        </div>

        <a
          ref={previewRef}
          href={siteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#C20E5A] px-4 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#A30B4A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C20E5A]"
        >
          <ExternalLink className="h-4 w-4 shrink-0" />
          Preview Live Website
        </a>
        <p className="mt-2 text-center text-[11px] text-gray-500">Opens in a new tab — your editor stays here.</p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={handleCopyLink}
            disabled={isCopying}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-3 py-3 text-xs font-bold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C20E5A]"
          >
            {isCopying ? <Loader2 className="h-4 w-4 animate-spin" /> : copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            {isCopying ? 'Copying…' : copied ? 'Copied!' : 'Copy Site Link'}
          </button>
          <button
            type="button"
            onClick={onBackToDashboard}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-900 bg-slate-900 px-3 py-3 text-xs font-bold text-white transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            <LayoutDashboard className="h-4 w-4" />
            Back to Dashboard
          </button>
        </div>

        {/* Keep clipboard feedback inside the dialog's top layer so it is visible and announced. */}
        {copyNotice && (
          <div
            role={copyNotice.type === 'error' ? 'alert' : 'status'}
            aria-atomic="true"
            className={`mt-4 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs font-medium ${
              copyNotice.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-rose-200 bg-rose-50 text-rose-800'
            }`}
          >
            {copyNotice.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
            <span>{copyNotice.message}</span>
          </div>
        )}

        {/* Phase 5: completion note — appears only when the backend's verified
            completion check reports the website is not finished yet. Never
            blocks the save-success state above. */}
        {completionNote && (
          <div
            role="status"
            aria-atomic="true"
            className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-medium text-amber-800"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{completionNote}</span>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mx-auto mt-5 block rounded px-2 py-1 text-xs font-semibold text-gray-500 underline underline-offset-4 hover:text-[#C20E5A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C20E5A]"
        >
          Keep editing
        </button>
      </div>
    </dialog>
  );
};
