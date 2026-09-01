import { useEffect, useRef } from 'react';

/**
 * Shared quick-search configuration for the search bars (Explore + Home).
 *
 * Opening a search bar shows a click-to-search dropdown so users can find the
 * main salon categories without typing. Every `query` below is tuned for the
 * fuzzy engine in `src/lib/fuzzySearch.ts` — tokens match across category,
 * service, stylist and amenity fields with typo tolerance.
 */

export interface QuickSearchCategory {
  id: string;
  /** Full label shown in the dropdown row. */
  label: string;
  /** Query injected into the search bar on tap (fuzzy-engine friendly). */
  query: string;
  /** Material Symbols outlined icon name. */
  icon: string;
  /** Tailwind classes for the icon chip. */
  tint: string;
}

/** The five main click-to-search categories offered on search focus. */
export const QUICK_SEARCH_CATEGORIES: QuickSearchCategory[] = [
  {
    id: 'barber-mens-grooming',
    label: "Barber / Men's Grooming",
    query: 'barber men grooming',
    icon: 'content_cut',
    tint: 'bg-primary/10 text-primary border-primary/20',
  },
  {
    id: 'hair-cut-styling',
    label: 'Hair Cut & Styling',
    query: 'hair cut styling',
    icon: 'face',
    tint: 'bg-violet-500/10 text-violet-600 border-violet-500/20',
  },
  {
    id: 'hydra-facial-skin',
    label: 'Hydra Facial & Skin Care',
    query: 'hydra facial skin',
    icon: 'water_drop',
    tint: 'bg-sky-500/10 text-sky-600 border-sky-500/20',
  },
  {
    id: 'beard-trim-shave',
    label: 'Beard Trim & Shave',
    query: 'beard trim shave',
    icon: 'face_retouching_natural',
    tint: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  },
  {
    id: 'spa-nails-art',
    label: 'Spa & Nails Art',
    query: 'spa nails',
    icon: 'spa',
    tint: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  },
];

/** Short trending tags so users rarely need to type at all. */
export const POPULAR_SEARCHES: string[] = [
  'haircut',
  'beard trim',
  'hydra facial',
  'spa',
  'nails art',
  'keratin',
  'detan',
  'bridal',
];

/**
 * Dismisses an open dropdown on outside pointer press or Escape.
 * Returns nothing; wire it to the wrapper ref of the anchored control.
 */
export function useDismissOnOutside(
  isOpen: boolean,
  onClose: () => void,
): React.RefObject<HTMLDivElement | null> {
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  return wrapperRef;
}
