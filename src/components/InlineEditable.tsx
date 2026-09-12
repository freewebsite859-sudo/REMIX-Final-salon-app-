import React, { useState, useEffect, useRef } from 'react';
import { Check, X, Edit3 } from 'lucide-react';

interface InlineEditableProps {
  value: string | number;
  onSave: (val: string | number) => void;
  isEditingActive?: boolean;
  type?: 'text' | 'textarea' | 'price' | 'number';
  prefix?: string;
  suffix?: string;
  className?: string;
  placeholder?: string;
  label?: string;
  tag?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span' | 'div';
}

export const InlineEditable: React.FC<InlineEditableProps> = ({
  value,
  onSave,
  isEditingActive = true,
  type = 'text',
  prefix = '',
  suffix = '',
  className = '',
  placeholder = 'Click to edit...',
  label,
  tag: Tag = 'span'
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState<string>(String(value));
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setTempValue(String(value));
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (type !== 'price' && type !== 'number') {
        inputRef.current.select();
      }
    }
  }, [isEditing, type]);

  const handleStartEdit = (e: React.MouseEvent) => {
    if (!isEditingActive) return;
    e.stopPropagation();
    e.preventDefault();
    setTempValue(String(value));
    setIsEditing(true);
  };

  const handleSave = (e?: React.MouseEvent | React.KeyboardEvent | React.FocusEvent) => {
    if (e) {
      e.stopPropagation();
    }
    let finalVal: string | number = tempValue.trim();
    if (type === 'price' || type === 'number') {
      const parsed = parseFloat(tempValue.replace(/[^0-9.]/g, ''));
      finalVal = isNaN(parsed) ? Number(value) : parsed;
    } else {
      if (!finalVal && placeholder) {
        finalVal = String(value);
      }
    }
    onSave(finalVal);
    setIsEditing(false);
  };

  const handleCancel = (e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setTempValue(String(value));
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (type === 'textarea' && !e.shiftKey) {
        e.preventDefault();
        handleSave(e);
      } else if (type !== 'textarea') {
        e.preventDefault();
        handleSave(e);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel(e);
    }
  };

  if (isEditing) {
    return (
      <span 
        className="inline-flex items-center gap-1 relative z-30 max-w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {prefix && <span className="font-bold opacity-80 select-none text-inherit">{prefix}</span>}
        
        {type === 'textarea' ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => handleSave()}
            rows={3}
            className={`w-full min-w-[200px] max-w-lg p-2 text-xs md:text-sm rounded-lg border-2 border-amber-500 bg-white text-slate-900 shadow-xl focus:outline-none focus:ring-2 focus:ring-amber-300 font-sans ${className}`}
            placeholder={placeholder}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type={type === 'price' || type === 'number' ? 'text' : 'text'}
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => handleSave()}
            className={`px-2 py-1 text-xs md:text-sm rounded-lg border-2 border-amber-500 bg-white text-slate-900 shadow-xl focus:outline-none focus:ring-2 focus:ring-amber-300 font-sans min-w-[80px] max-w-full ${className}`}
            placeholder={placeholder}
          />
        )}

        {suffix && <span className="font-bold opacity-80 select-none text-inherit">{suffix}</span>}

        <span className="inline-flex items-center gap-0.5 ml-1 shrink-0">
          <button
            type="button"
            onClick={handleSave}
            className="p-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer"
            title="Save (Enter)"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="p-1 rounded-md bg-slate-600 hover:bg-slate-700 text-white shadow-xs transition-colors cursor-pointer"
            title="Cancel (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </span>
      </span>
    );
  }

  // Display Mode
  return (
    <Tag
      onClick={handleStartEdit}
      className={`inline group/editable relative transition-all duration-200 ${
        isEditingActive
          ? 'cursor-pointer hover:outline-dashed hover:outline-2 hover:outline-amber-400 hover:outline-offset-2 hover:bg-amber-400/10 rounded-sm'
          : ''
      } ${className}`}
      title={isEditingActive ? `Click to edit ${label || 'text'}` : undefined}
    >
      <span>{prefix}</span>
      <span>{type === 'price' ? Number(value).toLocaleString('en-IN') : String(value)}</span>
      <span>{suffix}</span>
      {isEditingActive && (
        <span className="opacity-0 group-hover/editable:opacity-100 transition-opacity ml-1 inline-flex items-center text-amber-500 align-middle">
          <Edit3 className="w-3 h-3 inline-block" />
        </span>
      )}
    </Tag>
  );
};
