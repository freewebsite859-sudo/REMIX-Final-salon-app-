import React, { useState } from 'react';
import { SalonService, SalonProfile } from '../types';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  Clock, 
  Sparkles, 
  Check, 
  X, 
  Search, 
  Eye, 
  EyeOff, 
  Tag, 
  CheckCircle2, 
  AlertCircle,
  TrendingUp,
  Layers,
  HelpCircle,
  Lock,
  Scissors,
  Flower2,
  Heart,
  Brush,
  Droplet,
  Crown,
  Gem,
  Flame,
  Smile,
  Shield,
  Wand2,
  Sparkle,
  Paintbrush,
  Feather,
  Coffee,
  Star,
  Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GuestModeBanner } from './GuestModeBanner';

export const ICON_LIBRARY = [
  { name: 'Scissors', component: Scissors, label: 'Haircut & Trim' },
  { name: 'Sparkles', component: Sparkles, label: 'Facial & Glow' },
  { name: 'Flower2', component: Flower2, label: 'Spa & Massage' },
  { name: 'Heart', component: Heart, label: 'Therapy & Wellness' },
  { name: 'Brush', component: Brush, label: 'Makeup & Nails' },
  { name: 'Droplet', component: Droplet, label: 'Hair Spa & Wash' },
  { name: 'Crown', component: Crown, label: 'Bridal & Premium' },
  { name: 'Gem', component: Gem, label: 'Luxury Package' },
  { name: 'Flame', component: Flame, label: 'Hot Stone & Warm' },
  { name: 'Smile', component: Smile, label: 'Consultation' },
  { name: 'Shield', component: Shield, label: 'Skin Care & Clinic' },
  { name: 'Wand2', component: Wand2, label: 'Styling & Treat' },
  { name: 'Sparkle', component: Sparkle, label: 'Waxing & Thread' },
  { name: 'Paintbrush', component: Paintbrush, label: 'Nail Art' },
  { name: 'Feather', component: Feather, label: 'Light Touch' },
  { name: 'Coffee', component: Coffee, label: 'Add-on & Refresh' },
  { name: 'Star', component: Star, label: 'Special' },
  { name: 'Activity', component: Activity, label: 'Body Care' },
];

export const getServiceIcon = (iconName: string) => {
  const found = ICON_LIBRARY.find(i => i.name.toLowerCase() === iconName?.toLowerCase());
  return found ? found.component : Scissors;
};

interface ServiceManagementProps {
  services: SalonService[];
  setServices: React.Dispatch<React.SetStateAction<SalonService[]>>;
  primaryAccentColor: string;
  profile?: SalonProfile;
  onNavigateToPreview?: () => void;
  isAuthenticated?: boolean;
  onRequireAuth?: (mode?: 'login' | 'signup') => void;
}

const COMMON_CATEGORIES = [
  'Precision Cuts',
  'Hair Styling & Blowdry',
  'Hair Coloring & Balayage',
  'Keratin & Smoothing',
  'Facials & Cleanups',
  'Bridal & Groom Makeover',
  'Manicure & Pedicure',
  'Spa & Body Rituals',
  'Beard & Men Grooming',
  'Ayurvedic Care'
];

export const ServiceManagement: React.FC<ServiceManagementProps> = ({
  services,
  setServices,
  primaryAccentColor,
  profile,
  onNavigateToPreview,
  isAuthenticated = true,
  onRequireAuth,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('All');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [feedbackNotice, setFeedbackNotice] = useState<string>('');

  // Form State for Add / Edit
  const [formName, setFormName] = useState<string>('');
  const [formCategory, setFormCategory] = useState<string>('Precision Cuts');
  const [formCustomCategory, setFormCustomCategory] = useState<string>('');
  const [formDuration, setFormDuration] = useState<number>(45);
  const [formPrice, setFormPrice] = useState<number>(650);
  const [formDescription, setFormDescription] = useState<string>('');
  const [formPopular, setFormPopular] = useState<boolean>(false);
  const [formShowDuration, setFormShowDuration] = useState<boolean>(true);
  const [formIcon, setFormIcon] = useState<string>('Scissors');
  const [formError, setFormError] = useState<string>('');

  // Extract all distinct categories
  const allCategories = ['All', ...Array.from(new Set(services.map((s) => s.category || 'General')))];

  const showToast = (msg: string) => {
    setFeedbackNotice(msg);
    setTimeout(() => setFeedbackNotice(''), 3500);
  };

  const handleOpenAdd = () => {
    if (!isAuthenticated) {
      onRequireAuth?.('login');
      return;
    }
    setEditingServiceId(null);
    setFormName('');
    setFormCategory('Precision Cuts');
    setFormCustomCategory('');
    setFormDuration(45);
    setFormPrice(650);
    setFormDescription('');
    setFormPopular(false);
    setFormShowDuration(true);
    setFormIcon('Scissors');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (srv: SalonService) => {
    if (!isAuthenticated) {
      onRequireAuth?.('login');
      return;
    }
    setEditingServiceId(srv.id);
    setFormName(srv.name);
    if (COMMON_CATEGORIES.includes(srv.category)) {
      setFormCategory(srv.category);
      setFormCustomCategory('');
    } else {
      setFormCategory('custom');
      setFormCustomCategory(srv.category);
    }
    setFormDuration(srv.durationMinutes || 45);
    setFormPrice(srv.price || 0);
    setFormDescription(srv.description || '');
    setFormPopular(!!srv.popular);
    setFormShowDuration(srv.showDuration !== false);
    setFormIcon(srv.icon || 'Scissors');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSaveService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      onRequireAuth?.('login');
      return;
    }
    if (!formName.trim()) {
      setFormError('Service name is required.');
      return;
    }
    if (formPrice < 0) {
      setFormError('Price must be 0 or greater.');
      return;
    }
    if (formDuration <= 0) {
      setFormError('Duration must be greater than 0 minutes.');
      return;
    }

    const finalCategory = formCategory === 'custom'
      ? (formCustomCategory.trim() || 'General')
      : formCategory;

    if (editingServiceId) {
      // Edit existing
      setServices((prev) =>
        prev.map((s) =>
          s.id === editingServiceId
            ? {
                ...s,
                name: formName.trim(),
                category: finalCategory,
                durationMinutes: Number(formDuration),
                price: Number(formPrice),
                description: formDescription.trim(),
                popular: formPopular,
                showDuration: formShowDuration,
                icon: formIcon,
              }
            : s
        )
      );
      showToast(`Updated "${formName.trim()}" successfully.`);
    } else {
      // Add new
      const newService: SalonService = {
        id: `srv-${Date.now()}`,
        name: formName.trim(),
        category: finalCategory,
        durationMinutes: Number(formDuration),
        price: Number(formPrice),
        description: formDescription.trim(),
        icon: formIcon,
        popular: formPopular,
        showDuration: formShowDuration,
      };
      setServices((prev) => [newService, ...prev]);
      showToast(`Added new service "${formName.trim()}" to menu.`);
    }

    setIsModalOpen(false);
  };

  const handleDelete = (id: string, name: string) => {
    if (!isAuthenticated) {
      onRequireAuth?.('login');
      return;
    }
    if (window.confirm(`Are you sure you want to remove "${name}" from your service catalog?`)) {
      setServices((prev) => prev.filter((s) => s.id !== id));
      showToast(`Deleted service "${name}".`);
    }
  };

  const handleToggleShowDuration = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!isAuthenticated) {
      onRequireAuth?.('login');
      return;
    }
    setServices((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const currentShow = s.showDuration !== false;
        const updatedShow = !currentShow;
        showToast(
          updatedShow
            ? `Duration will now be shown publicly for "${s.name}".`
            : `Duration is now hidden on the public menu for "${s.name}".`
        );
        return {
          ...s,
          showDuration: updatedShow,
        };
      })
    );
  };

  const handleTogglePopular = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!isAuthenticated) {
      onRequireAuth?.('login');
      return;
    }
    setServices((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        return {
          ...s,
          popular: !s.popular,
        };
      })
    );
  };

  // Filtered Services
  const filteredServices = services.filter((s) => {
    const matchesCategory = selectedCategoryFilter === 'All' || s.category === selectedCategoryFilter;
    const matchesSearch =
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.category.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const totalHiddenDurationCount = services.filter((s) => s.showDuration === false).length;

  return (
    <div className="flex flex-col gap-6" id="services-management-section">

      {/* Toast Notice */}
      <AnimatePresence>
        {feedbackNotice && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed top-20 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-semibold border border-slate-700"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{feedbackNotice}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER SECTION & SUMMARY CARDS */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs flex flex-col gap-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span 
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: primaryAccentColor }}
              />
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-gray-400">
                Catalog & Pricing Manager
              </span>
            </div>
            <h2 className="font-display font-bold text-2xl text-gray-900 mt-1">
              Services & Menu Editor
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Manage your treatment catalog, INR (₹) rates, category grouping, and control public duration visibility on your live booking site.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onNavigateToPreview && (
              <button
                type="button"
                onClick={onNavigateToPreview}
                className="px-3.5 py-2 rounded-xl text-xs font-bold border border-gray-200 hover:bg-gray-50 text-gray-700 flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <Eye className="w-3.5 h-3.5 text-gray-500" />
                <span>View Public Menu</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleOpenAdd}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer shadow-xs hover:opacity-95"
              style={{ backgroundColor: primaryAccentColor }}
              title={!isAuthenticated ? 'Log in to add service' : 'Add New Service'}
              id="add-new-service-btn"
            >
              {!isAuthenticated ? <Lock className="w-3.5 h-3.5" /> : <Plus className="w-4 h-4" />}
              <span>Add New Service</span>
            </button>
          </div>
        </div>

        {/* Quick Stat Pill Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl border border-gray-100 bg-gray-50/70 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-mono uppercase text-gray-400 block font-semibold">
                Total Services
              </span>
              <span className="text-xl font-bold font-mono text-gray-900 mt-0.5 block">
                {services.length}
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-700">
              <Layers className="w-4 h-4" />
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-gray-100 bg-gray-50/70 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-mono uppercase text-gray-400 block font-semibold">
                Categories
              </span>
              <span className="text-xl font-bold font-mono text-gray-900 mt-0.5 block">
                {allCategories.length - 1}
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700">
              <Tag className="w-4 h-4" />
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-gray-100 bg-gray-50/70 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-mono uppercase text-gray-400 block font-semibold">
                Duration Display
              </span>
              <span className="text-xs font-mono font-bold text-gray-700 mt-1 block">
                <span className="text-emerald-700 font-bold">{services.length - totalHiddenDurationCount} Shown</span>
                {totalHiddenDurationCount > 0 && (
                  <span className="text-amber-700 ml-1.5">({totalHiddenDurationCount} Hidden)</span>
                )}
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-700">
              <Clock className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* SEARCH AND CATEGORY FILTER BAR */}
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between pt-2">
          {/* Search box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search services by title, description, or category..."
              className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-gray-200 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-thin">
            {allCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategoryFilter(cat)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-xl whitespace-nowrap transition-colors cursor-pointer ${
                  selectedCategoryFilter === cat
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* SERVICES GRID */}
        {filteredServices.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50 flex flex-col items-center justify-center gap-2">
            <span className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-400">
              <Layers className="w-6 h-6" />
            </span>
            <p className="font-bold text-sm text-gray-700">No services match your filters</p>
            <p className="text-xs text-gray-400 max-w-sm">
              Try adjusting your search query or reset category filter to see all catalog items.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setSelectedCategoryFilter('All');
              }}
              className="mt-2 text-xs font-bold text-purple-700 hover:underline cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
            {filteredServices.map((srv) => {
              const isDurationVisible = srv.showDuration !== false;

              return (
                <div
                  key={srv.id}
                  className="p-4 rounded-2xl border border-gray-200 bg-white hover:border-gray-300 hover:shadow-xs transition-all flex flex-col justify-between gap-3 group"
                >
                  <div>
                    {/* Top line: Name & Pricing */}
                    <div className="flex items-start gap-3 justify-between">
                      <div className="flex items-start gap-2.5 flex-1 min-w-0">
                        {/* Service Icon Box */}
                        <div 
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs border"
                          style={{ 
                            backgroundColor: `${primaryAccentColor}0d`, 
                            borderColor: `${primaryAccentColor}22`,
                            color: primaryAccentColor
                          }}
                        >
                          {React.createElement(getServiceIcon(srv.icon), { className: "w-5 h-5" })}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-extrabold text-sm text-slate-900">{srv.name}</h4>
                            {srv.popular && (
                              <span 
                                className="text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-md shadow-2xs border border-white/20"
                                style={{ backgroundColor: primaryAccentColor, color: 'var(--accent-text-color, #ffffff)' }}
                              >
                                POPULAR
                              </span>
                            )}
                          </div>

                          <span className="text-[11px] font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md inline-block mt-1">
                            {srv.category}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-display font-extrabold text-lg text-emerald-800 font-mono">
                          ₹{srv.price.toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    {srv.description && (
                      <p className="text-xs text-gray-600 mt-2 leading-relaxed line-clamp-2">
                        {srv.description}
                      </p>
                    )}

                    {/* Duration Display Status Pill & Public Toggle */}
                    <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between flex-wrap gap-2 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="flex items-center gap-1 font-mono text-gray-600 font-medium text-xs bg-gray-50 border border-gray-200 px-2 py-1 rounded-lg">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          <span>{srv.durationMinutes} mins</span>
                        </span>

                        {/* Show Duration Public Indicator Badge */}
                        <span
                          className={`text-[11px] font-mono px-2 py-0.5 rounded-md flex items-center gap-1 font-medium border ${
                            isDurationVisible
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          {isDurationVisible ? (
                            <>
                              <Eye className="w-3 h-3 text-emerald-600" />
                              <span>Visible on Website</span>
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3 h-3 text-amber-600" />
                              <span>Hidden on Website</span>
                            </>
                          )}
                        </span>
                      </div>

                      {/* Quick Inline Show Duration Toggle Button */}
                      <button
                        type="button"
                        onClick={(e) => handleToggleShowDuration(srv.id, e)}
                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors flex items-center gap-1 cursor-pointer ${
                          isDurationVisible
                            ? 'border-gray-200 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-300 text-gray-600'
                            : 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                        }`}
                        title={
                          isDurationVisible
                            ? 'Click to hide duration from the public website menu'
                            : 'Click to show duration on the public website menu'
                        }
                      >
                        {isDurationVisible ? (
                          <>
                            <EyeOff className="w-3 h-3" />
                            <span>Hide Duration</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-3 h-3" />
                            <span>Show Duration</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Card Bottom Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={(e) => handleTogglePopular(srv.id, e)}
                      className={`text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                        srv.popular ? 'text-amber-700' : 'text-gray-400 hover:text-gray-700'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{srv.popular ? 'Featured (Popular)' : 'Mark as Popular'}</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(srv)}
                        className="p-1.5 text-xs font-semibold text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                        title={!isAuthenticated ? 'Log in to edit service' : 'Edit Service Details'}
                      >
                        {!isAuthenticated ? <Lock className="w-3.5 h-3.5 text-gray-400" /> : <Edit3 className="w-3.5 h-3.5 text-gray-500" />}
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(srv.id, srv.name)}
                        className="p-1.5 text-xs font-semibold text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                        title={!isAuthenticated ? 'Log in to remove service' : 'Delete Service'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ADD / EDIT SERVICE MODAL WITH 'SHOW DURATION' TOGGLE */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs font-sans">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden text-gray-800"
            >
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between shrink-0 bg-gray-50/70">
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-xs"
                    style={{ backgroundColor: primaryAccentColor }}
                  >
                    <Tag className="w-4 h-4" />
                  </span>
                  <div>
                    <h3 className="font-display font-bold text-base text-gray-900">
                      {editingServiceId ? 'Edit Service' : 'Add New Service to Menu'}
                    </h3>
                    <p className="text-[11px] text-gray-500">
                      Configure treatment name, pricing, duration, and website visibility.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body / Form */}
              <form onSubmit={handleSaveService} className="p-5 flex flex-col gap-4 overflow-y-auto max-h-[75vh]">
                {formError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Service Name */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Service Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Master Precision Cut & Argan Wash"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                  />
                </div>

                {/* Category Selection */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent bg-white"
                  >
                    {COMMON_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                    <option value="custom">+ Custom Category</option>
                  </select>

                  {formCategory === 'custom' && (
                    <input
                      type="text"
                      value={formCustomCategory}
                      onChange={(e) => setFormCustomCategory(e.target.value)}
                      placeholder="Enter custom category name..."
                      className="w-full mt-2 px-3.5 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                    />
                  )}
                </div>

                {/* Service Icon Picker */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    Service Icon <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-6 gap-1.5 p-2.5 bg-gray-50 rounded-xl border border-gray-200">
                    {ICON_LIBRARY.map((item) => {
                      const IconComponent = item.component;
                      const isSelected = formIcon === item.name;
                      return (
                        <button
                          key={item.name}
                          type="button"
                          onClick={() => setFormIcon(item.name)}
                          className={`p-1.5 rounded-lg flex flex-col items-center justify-center transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-white text-slate-900 ring-2 ring-slate-900/10 border border-slate-300 shadow-2xs'
                              : 'bg-white hover:bg-gray-100 text-gray-500 border border-gray-100 hover:text-gray-900'
                          }`}
                          title={item.label}
                        >
                          <IconComponent className="w-4 h-4 shrink-0" />
                          <span className="text-[8px] font-bold mt-1 truncate max-w-full text-gray-400">
                            {item.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Price & Duration Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Price (INR ₹) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500 font-mono">
                        ₹
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="10"
                        required
                        value={formPrice}
                        onChange={(e) => setFormPrice(Number(e.target.value))}
                        className="w-full pl-7 pr-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent font-mono font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Duration (Minutes) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="5"
                        step="5"
                        required
                        value={formDuration}
                        onChange={(e) => setFormDuration(Number(e.target.value))}
                        className="w-full pl-3 pr-12 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent font-mono font-bold"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-mono">
                        mins
                      </span>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Service Description
                  </label>
                  <textarea
                    rows={3}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Describe the treatment steps, hair/skin benefits, or techniques used..."
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent resize-none leading-relaxed"
                  />
                </div>

                {/* ========================================================= */}
                {/* TOGGLE: SHOW DURATION ON WEBSITE MENU */}
                {/* ========================================================= */}
                <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/70 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-700 shrink-0">
                        {formShowDuration ? (
                          <Eye className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <EyeOff className="w-4 h-4 text-amber-600" />
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                          <span>Show Duration</span>
                          <span
                            className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                              formShowDuration
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {formShowDuration ? 'Public' : 'Hidden'}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500">
                          Controls whether the {formDuration} mins duration is displayed publicly on the website menu.
                        </p>
                      </div>
                    </div>

                    {/* Switch Toggle */}
                    <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
                      <input
                        type="checkbox"
                        checked={formShowDuration}
                        onChange={(e) => setFormShowDuration(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>

                  {!formShowDuration && (
                    <div className="mt-1 text-[11px] text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200 flex items-start gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <span>
                        When turned off, clients will only see the title and ₹{formPrice} price on the public website menu.
                      </span>
                    </div>
                  )}
                </div>

                {/* TOGGLE: POPULAR / FEATURED */}
                <div className="p-3.5 rounded-xl border border-gray-200 bg-white flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <div>
                      <div className="text-xs font-bold text-gray-900">Featured / Popular Badge</div>
                      <div className="text-[11px] text-gray-500">Highlight this treatment with a badge on the menu.</div>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
                    <input
                      type="checkbox"
                      checked={formPopular}
                      onChange={(e) => setFormPopular(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>

                {/* Form Buttons */}
                <div className="pt-2 flex items-center justify-end gap-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer shadow-xs hover:opacity-95"
                    style={{ backgroundColor: primaryAccentColor }}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{editingServiceId ? 'Save Changes' : 'Create Service'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
