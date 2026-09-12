import React, { useState, useRef } from 'react';
import { Upload, Image as ImageIcon, CheckCircle2, RefreshCw, AlertCircle, Sparkles, Download, FileImage, Layers } from 'lucide-react';
import { compressAndResizeImage, CompressionResult } from '../utils/imageUploadHelper';

interface ImageCompressorWidgetProps {
  onApplyLogo?: (compressedDataUrl: string) => void;
  onApplyCover?: (compressedDataUrl: string) => void;
  themePrimaryColor?: string;
}

export const ImageCompressorWidget: React.FC<ImageCompressorWidgetProps> = ({
  onApplyLogo,
  onApplyCover,
  themePrimaryColor = '#b0004a'
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [compressResult, setCompressResult] = useState<CompressionResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file) return;
    setIsLoading(true);
    setErrorMsg(null);

    try {
      // Compress & Auto-Resize using HTML5 Canvas API (aiming for <= 2MB, downscaling to max 1600px width/height)
      const result = await compressAndResizeImage(file);
      
      if (result.isValid) {
        setCompressResult(result);
      } else {
        setErrorMsg(result.errorMessage || 'Failed to process and compress image.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred during compression.');
    } finally {
      setIsLoading(false);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const triggerSelect = () => {
    fileInputRef.current?.click();
  };

  const downloadImage = () => {
    if (!compressResult?.dataUrl) return;
    const link = document.createElement('a');
    link.href = compressResult.dataUrl;
    link.download = `optimized_${compressResult.fileName.split('.')[0] || 'photo'}.${compressResult.fileType === 'image/png' ? 'png' : 'jpg'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-4">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
        <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
          <Layers className="w-4 h-4" />
        </div>
        <div>
          <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1">
            <span>Image Compressor & Auto-Resize</span>
            <span className="bg-amber-100 text-amber-800 text-[9px] px-1.5 py-0.2 rounded-full font-extrabold uppercase">
              Auto &lt;= 2MB
            </span>
          </h4>
          <p className="text-[10px] text-slate-400 font-medium">Auto-scales dimensions & reduces file size iteratively</p>
        </div>
      </div>

      {/* Drag & Drop Area */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={triggerSelect}
        className={`border-2 border-dashed rounded-xl p-5 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-2 ${
          isDragging
            ? 'border-amber-500 bg-amber-50/40 scale-[0.99]'
            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={onFileChange}
          accept="image/png, image/jpeg, image/jpg, image/webp"
          className="hidden"
        />

        {isLoading ? (
          <div className="flex flex-col items-center gap-2.5 py-2">
            <RefreshCw className="w-7 h-7 text-amber-500 animate-spin" />
            <div className="text-xs font-bold text-slate-700 animate-pulse">Resizing & Compressing Photo...</div>
            <p className="text-[10px] text-slate-400">Processing on local HTML5 Canvas context</p>
          </div>
        ) : (
          <>
            <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400">
              <Upload className="w-5 h-5 text-slate-500" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800">
                Drag & drop or <span className="text-amber-600 underline">browse photo</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Supports High-Res PNG, JPG, JPEG, WEBP</p>
            </div>
          </>
        )}
      </div>

      {/* File Size Limits and Instructions */}
      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-150 flex items-start gap-2">
        <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
        <div className="text-[10px] text-slate-600 space-y-0.5 font-medium">
          <span className="font-bold text-slate-900 block">Automatic Constraint Check:</span>
          <span>Max final file limit is <strong className="text-slate-900">2 MB</strong>. Larger high-res files (e.g. 5MB–10MB) will be downscaled dynamically while preserving aspect ratios to prevent distortion.</span>
        </div>
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div className="p-3 bg-rose-50 text-rose-700 rounded-xl border border-rose-100 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Real-time Compression Results & Previews */}
      {compressResult && !isLoading && (
        <div className="space-y-3.5 border-t border-slate-100 pt-3 animate-in fade-in duration-300">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Compression Stats & Live Preview:
            </span>
            <button
              onClick={() => setCompressResult(null)}
              className="text-[10px] font-bold text-slate-400 hover:text-slate-600 hover:bg-slate-50 px-2 py-0.5 rounded border border-slate-150 cursor-pointer"
            >
              Reset / Change
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-3 rounded-xl border border-slate-150 font-medium">
            <div className="space-y-1.5 border-r border-slate-200 pr-2">
              <div className="text-[10px] text-slate-400 font-bold uppercase">Original</div>
              <div className="text-slate-800 font-semibold truncate" title={compressResult.fileName}>
                {compressResult.fileName}
              </div>
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>File Size:</span>
                <span className="font-bold text-slate-700">{compressResult.originalSizeKb} KB</span>
              </div>
            </div>

            <div className="space-y-1.5 pl-2">
              <div className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1">
                <span>Optimized</span>
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              </div>
              <div className="text-emerald-700 font-bold flex items-center gap-1">
                <span>{compressResult.compressedSizeKb} KB</span>
                {compressResult.compressionRatio > 0 && (
                  <span className="bg-emerald-100 text-emerald-800 text-[9px] px-1.5 py-0.2 rounded font-extrabold">
                    -{compressResult.compressionRatio}%
                  </span>
                )}
              </div>
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>Resolution:</span>
                <span className="font-bold text-slate-700">
                  {compressResult.width} × {compressResult.height}
                </span>
              </div>
            </div>
          </div>

          {/* Compressed Image Live Preview */}
          <div className="relative rounded-xl overflow-hidden border border-slate-200 h-32 bg-slate-100 flex items-center justify-center">
            <img
              src={compressResult.dataUrl}
              alt="Optimized Preview"
              className="max-w-full max-h-full object-contain"
              referrerPolicy="no-referrer"
            />
            <div className="absolute top-2 left-2 bg-slate-900/75 text-white text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
              <ImageIcon className="w-3 h-3" />
              <span>Optimized Preview ({compressResult.fileType.split('/')[1]?.toUpperCase()})</span>
            </div>
          </div>

          {/* Actions to apply the compressed image */}
          <div className="grid grid-cols-3 gap-1.5 pt-1">
            {onApplyLogo && (
              <button
                type="button"
                onClick={() => {
                  if (compressResult.dataUrl) {
                    onApplyLogo(compressResult.dataUrl);
                  }
                }}
                className="py-1.5 px-2 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold rounded-lg text-[10px] text-center border border-purple-200 shadow-3xs hover:scale-102 active:scale-98 transition-all cursor-pointer"
              >
                Apply as Logo
              </button>
            )}

            {onApplyCover && (
              <button
                type="button"
                onClick={() => {
                  if (compressResult.dataUrl) {
                    onApplyCover(compressResult.dataUrl);
                  }
                }}
                className="py-1.5 px-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-[10px] text-center shadow-3xs hover:scale-102 active:scale-98 transition-all cursor-pointer"
              >
                Apply as Cover
              </button>
            )}

            <button
              type="button"
              onClick={downloadImage}
              className="py-1.5 px-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg text-[10px] text-center flex items-center justify-center gap-1 shadow-3xs hover:scale-102 active:scale-98 transition-all cursor-pointer col-span-1"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span>Save File</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
