import React, { useState, useEffect } from 'react';
import { Sparkles, Check, X, RefreshCw, Layers, CheckCircle2, Wand2, Eye, Download } from 'lucide-react';
import { BusinessTypeId } from '../types';
import { generateAILogoSuite, AILogoConcept } from '../utils/logoGenerator';

interface AILogoSuiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  salonName: string;
  categoryKey: BusinessTypeId;
  primaryColor: string;
  currentLogoUrl?: string;
  onSelectLogo: (logoDataUrl: string) => void;
}

export const AILogoSuiteModal: React.FC<AILogoSuiteModalProps> = ({
  isOpen,
  onClose,
  salonName,
  categoryKey,
  primaryColor,
  currentLogoUrl,
  onSelectLogo,
}) => {
  const [concepts, setConcepts] = useState<AILogoConcept[]>([]);
  const [selectedConceptId, setSelectedConceptId] = useState<string | null>(null);
  const [previewBg, setPreviewBg] = useState<'light' | 'dark' | 'transparent'>('light');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [appliedToast, setAppliedToast] = useState<string | null>(null);

  // Generate concepts whenever modal opens or inputs change
  useEffect(() => {
    if (isOpen) {
      handleGenerate();
    }
  }, [isOpen, salonName, categoryKey, primaryColor]);

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      const generated = generateAILogoSuite(salonName, categoryKey, primaryColor);
      setConcepts(generated);
      setIsGenerating(false);
    }, 300);
  };

  const handleApplyLogo = (concept: AILogoConcept) => {
    setSelectedConceptId(concept.id);
    onSelectLogo(concept.svgDataUrl);
    setAppliedToast(`Applied "${concept.name}" to your salon header!`);
    setTimeout(() => setAppliedToast(null), 3000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto font-sans animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-4xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-500 text-white flex items-center justify-center shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                <span>AI Auto-Generated Logo Suite</span>
                <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[11px] font-bold">
                  5 Concepts
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Tailored for <strong>{salonName}</strong> in <strong>{categoryKey.replace('_', ' ')}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer border border-purple-200 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
              <span>Regenerate Suite</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-200/60 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Applied Toast */}
        {appliedToast && (
          <div className="bg-emerald-600 text-white text-xs font-bold py-2 px-4 flex items-center gap-2 justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4" />
            <span>{appliedToast}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
            <div className="flex items-center gap-2 font-medium text-slate-700">
              <Layers className="w-4 h-4 text-purple-600" />
              <span>Canvas Preview Mode:</span>
            </div>
            <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setPreviewBg('light')}
                className={`px-3 py-1 rounded-md font-semibold text-[11px] transition-all cursor-pointer ${
                  previewBg === 'light' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Light Canvas
              </button>
              <button
                type="button"
                onClick={() => setPreviewBg('dark')}
                className={`px-3 py-1 rounded-md font-semibold text-[11px] transition-all cursor-pointer ${
                  previewBg === 'dark' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Dark Canvas
              </button>
              <button
                type="button"
                onClick={() => setPreviewBg('transparent')}
                className={`px-3 py-1 rounded-md font-semibold text-[11px] transition-all cursor-pointer ${
                  previewBg === 'transparent' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Grid Pattern
              </button>
            </div>
          </div>

          {/* 5 Concept Cards Grid */}
          {isGenerating ? (
            <div className="py-16 text-center space-y-3">
              <Sparkles className="w-10 h-10 text-purple-600 animate-spin mx-auto" />
              <p className="text-sm font-bold text-slate-700">Generating 5 Custom Vector Logo Variations...</p>
              <p className="text-xs text-slate-400">Crafting typography, emblems, and category vector marks</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {concepts.map((concept, index) => {
                const isSelected = selectedConceptId === concept.id || currentLogoUrl === concept.svgDataUrl;
                return (
                  <div
                    key={concept.id}
                    className={`group relative rounded-2xl border-2 transition-all duration-200 overflow-hidden flex flex-col justify-between ${
                      isSelected
                        ? 'border-purple-600 shadow-xl ring-2 ring-purple-400/30'
                        : 'border-slate-200 hover:border-slate-300 hover:shadow-md bg-white'
                    }`}
                  >
                    {/* Concept Header Badge */}
                    <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800 text-[11px]">
                        #{index + 1} {concept.styleTag}
                      </span>
                      {isSelected && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          Active
                        </span>
                      )}
                    </div>

                    {/* Logo SVG Render Area */}
                    <div
                      className={`p-4 flex items-center justify-center min-h-[130px] transition-colors relative ${
                        previewBg === 'dark'
                          ? 'bg-[#0f0f13]'
                          : previewBg === 'transparent'
                          ? 'bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:12px_12px] bg-slate-50'
                          : 'bg-white'
                      }`}
                    >
                      <img
                        src={concept.svgDataUrl}
                        alt={concept.name}
                        className="max-h-20 w-auto object-contain transition-transform group-hover:scale-105"
                      />
                    </div>

                    {/* Concept Footer Details */}
                    <div className="p-3 bg-white border-t border-slate-100 space-y-2">
                      <h4 className="font-bold text-xs text-slate-900 truncate">{concept.name}</h4>
                      <p className="text-[11px] text-slate-500 line-clamp-2 leading-snug">
                        {concept.description}
                      </p>

                      <button
                        type="button"
                        onClick={() => handleApplyLogo(concept)}
                        className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-slate-900 hover:bg-slate-800 text-white'
                        }`}
                      >
                        <Wand2 className="w-3.5 h-3.5" />
                        <span>{isSelected ? 'Applied as Header Logo' : 'Apply This Logo'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>✨ You can switch, upload, or update logos anytime in the Side Customizer.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
