import React, { useRef, useState } from 'react';
import { AlertCircle, Check, RefreshCw, Upload } from 'lucide-react';
import {
  prepareStylistAvatar,
  STYLIST_AVATAR_HELPER_TEXT,
} from '../utils/imageUploadHelper';

export interface StylistAvatarUploadProps {
  value: string;
  onChange: (dataUrl: string) => void;
  accentHex?: string;
  fallbackUrl?: string;
  /** Hide the section heading when the parent already labels it. */
  showHeading?: boolean;
}

/**
 * Drag-and-drop stylist profile photo: 5 MB cap, 1:1 cover crop, theme balance.
 */
export const StylistAvatarUpload: React.FC<StylistAvatarUploadProps> = ({
  value,
  onChange,
  accentHex = '#C20E5A',
  fallbackUrl,
  showHeading = true,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');

  const preview = value || fallbackUrl || '';

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError('');
    const result = await prepareStylistAvatar(file);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = '';
    if (!result.isValid || !result.dataUrl) {
      setError(result.errorMessage || 'Could not process this photo.');
      return;
    }
    setFileName(file.name);
    onChange(result.dataUrl);
  };

  return (
    <div id="stylist-profile-photo" className="flex flex-col gap-2">
      {showHeading ? (
        <label className="block text-xs font-bold text-gray-700">Stylist Profile Photo</label>
      ) : null}

      <p className="text-[11px] text-gray-500 leading-relaxed">{STYLIST_AVATAR_HELPER_TEXT}</p>

      <div className="flex items-start gap-3">
        <div
          className="relative w-20 h-20 rounded-2xl overflow-hidden border border-gray-200 shadow-xs shrink-0 bg-gray-50"
          data-avatar-frame="1:1"
          aria-label="1:1 avatar preview"
        >
          {preview ? (
            <img
              src={preview}
              alt="Stylist profile preview"
              className="absolute inset-0 w-full h-full object-cover object-center"
              style={{ aspectRatio: '1 / 1' }}
              onError={(e) => {
                if (fallbackUrl) (e.target as HTMLImageElement).src = fallbackUrl;
              }}
            />
          ) : (
            <span className="absolute inset-0 grid place-items-center text-gray-300">
              <Upload className="w-5 h-5" />
            </span>
          )}
          {value.startsWith('data:image/') ? (
            <span className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-emerald-500 text-white grid place-items-center shadow-xs">
              <Check className="w-3 h-3 stroke-[3]" />
            </span>
          ) : null}
        </div>

        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void handleFile(event.dataTransfer.files?.[0]);
          }}
          onClick={() => inputRef.current?.click()}
          className={`flex-1 min-h-[80px] rounded-2xl border-2 border-dashed px-3 py-2.5 flex flex-col items-center justify-center text-center gap-1 cursor-pointer transition-colors ${
            dragging ? 'bg-rose-50' : 'bg-gray-50/70 hover:bg-gray-50'
          }`}
          style={{ borderColor: dragging ? accentHex : '#e5e7eb' }}
          data-drop-zone="stylist-avatar"
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            className="hidden"
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
          {busy ? (
            <span className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" style={{ color: accentHex }} />
              Fitting photo to 1:1 frame…
            </span>
          ) : (
            <>
              <span className="flex items-center gap-1.5 text-xs font-bold text-gray-800">
                <Upload className="w-3.5 h-3.5 text-gray-500" />
                Drag & drop or browse
              </span>
              <span className="text-[10px] text-gray-500">
                {fileName ? fileName : 'Auto-centre crop · no stretch · theme balance'}
              </span>
            </>
          )}
        </div>
      </div>

      {error ? (
        <div
          className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800"
          role="alert"
          data-upload-error="true"
        >
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span className="font-semibold">{error}</span>
        </div>
      ) : null}
    </div>
  );
};
