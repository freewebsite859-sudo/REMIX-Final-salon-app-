import React from 'react';
import { motion } from 'motion/react';
import { BusinessTypeId } from '../../types';
import { CATEGORY_TEMPLATES } from '../../categoryTemplates';

export interface ServiceCategoryShowcaseProps {
  onSelectCategory?: (categoryId: BusinessTypeId) => void;
  onViewAll?: () => void;
  /** Max number of categories shown in the grid (defaults to 8) */
  limit?: number;
  className?: string;
}

/**
 * Curated, visually-rich grid of service categories (hair, nails, skin, spa…)
 * driven by the CATEGORY_TEMPLATES catalog so it stays in sync with the templates.
 */
export const ServiceCategoryShowcase: React.FC<ServiceCategoryShowcaseProps> = ({
  onSelectCategory,
  onViewAll,
  limit = 8,
  className = '',
}) => {
  const categories = Object.values(CATEGORY_TEMPLATES).slice(0, limit);

  return (
    <section
      className={`pt-8 border-t border-outline-variant/30 flex flex-col gap-6 ${className}`}
      aria-labelledby="service-showcase-heading"
      data-testid="service-category-showcase"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-primary">
            Every Service, Beautifully Presented
          </span>
          <h2
            id="service-showcase-heading"
            className="text-2xl sm:text-3xl font-extrabold tracking-tight text-on-surface mt-1"
          >
            Browse by Service Category
          </h2>
          <p className="text-sm text-on-surface-variant mt-1">
            From executive cuts to bridal mehendi — each category ships with curated sub-services, stylists, and INR (₹) pricing.
          </p>
        </div>
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="text-xs font-bold text-primary hover:underline flex items-center gap-1 shrink-0"
          >
            <span>See all {Object.keys(CATEGORY_TEMPLATES).length} categories</span>
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {categories.map((cat, i) => {
          const fromPrice = Math.min(...cat.services.map((s) => s.price));
          const isFeature = i === 0;
          return (
            <motion.button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory?.(cat.id)}
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.5, delay: (i % 4) * 0.08, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -6 }}
              className={`group relative text-left rounded-2xl overflow-hidden border border-outline-variant/30 bg-slate-900 shadow-md hover:shadow-2xl hover:shadow-primary/20 transition-shadow cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                isFeature ? 'col-span-2 row-span-2 min-h-[280px]' : 'min-h-[200px]'
              }`}
              data-testid={`service-category-${cat.id}`}
            >
              <img
                src={cat.coverImageUrl}
                alt={cat.title}
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-95 group-hover:scale-105 transition-all duration-700 ease-out"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />

              {/* Top row */}
              <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                <span className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 text-white flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">{cat.icon}</span>
                </span>
                <span className="text-[10px] font-mono font-bold text-white bg-white/15 backdrop-blur-md border border-white/20 px-2 py-0.5 rounded-full">
                  From ₹{fromPrice.toLocaleString('en-IN')}
                </span>
              </div>

              {/* Bottom copy */}
              <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                <h3 className={`font-display font-extrabold leading-tight ${isFeature ? 'text-2xl' : 'text-base'}`}>
                  {cat.shortName}
                </h3>
                <p className={`text-slate-200 mt-1 leading-snug ${isFeature ? 'text-sm line-clamp-2' : 'text-[11px] line-clamp-1'}`}>
                  {cat.tagline}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {cat.subCategories.slice(0, isFeature ? 4 : 2).map((sub) => (
                    <span
                      key={sub}
                      className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/10 border border-white/15 text-slate-100"
                    >
                      {sub}
                    </span>
                  ))}
                </div>
                <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-primary-fixed opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                  Explore {cat.shortName}
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
};
