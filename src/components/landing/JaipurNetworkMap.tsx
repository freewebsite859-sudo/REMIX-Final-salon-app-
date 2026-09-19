import React, { useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Salon } from '../../types';

/* -------------------------------------------------------------------------- */
/*  Jaipur network map                                                          */
/*  A lightweight SVG "placeholder" map: schematic ring roads, landmark labels  */
/*  and lat/lng-projected salon markers. Swappable for Google/Mapbox later —    */
/*  the marker/filter/controls layer is independent of the base layer.         */
/* -------------------------------------------------------------------------- */

export type MapCategoryFilter = 'all' | 'hair' | 'skin' | 'nails' | 'spa' | 'men';

const FILTERS: { id: MapCategoryFilter; label: string; icon: string; match: (s: Salon) => boolean }[] = [
  { id: 'all', label: 'All', icon: 'apps', match: () => true },
  { id: 'hair', label: 'Hair', icon: 'content_cut', match: (s) => s.tags.some((t) => /hair|salon|styling/.test(t)) },
  { id: 'skin', label: 'Skin', icon: 'face', match: (s) => s.tags.some((t) => /skin|facial|derma|medi/.test(t)) },
  { id: 'nails', label: 'Nails', icon: 'brush', match: (s) => s.tags.some((t) => /nail|couture|art/.test(t)) },
  { id: 'spa', label: 'Spa', icon: 'spa', match: (s) => s.tags.some((t) => /spa|wellness|massage|ayur/.test(t)) },
  { id: 'men', label: 'Men', icon: 'man', match: (s) => s.gender === 'men' || s.tags.some((t) => /barber|beard/.test(t)) },
];

// Jaipur bounding box used for projection.
const BOUNDS = { minLat: 26.80, maxLat: 26.96, minLng: 75.72, maxLng: 75.88 };
const VIEW = { w: 800, h: 560 };

const JAIPUR_AREAS = [
  { name: 'Vaishali Nagar', lat: 26.911, lng: 75.741 },
  { name: 'C-Scheme', lat: 26.909, lng: 75.799 },
  { name: 'Pink City', lat: 26.924, lng: 75.826 },
  { name: 'Malviya Nagar', lat: 26.855, lng: 75.812 },
  { name: 'Mansarovar', lat: 26.851, lng: 75.762 },
  { name: 'Raja Park', lat: 26.897, lng: 75.828 },
  { name: 'Tonk Road', lat: 26.868, lng: 75.795 },
  { name: 'Jagatpura', lat: 26.822, lng: 75.860 },
  { name: 'Bani Park', lat: 26.930, lng: 75.790 },
];

const project = (lat: number, lng: number) => ({
  x: ((lng - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng)) * VIEW.w,
  y: (1 - (lat - BOUNDS.minLat) / (BOUNDS.maxLat - BOUNDS.minLat)) * VIEW.h,
});

/** Deterministically spread salons across Jaipur neighbourhoods for the demo network. */
export const placeSalonsInJaipur = (salons: Salon[]): Salon[] =>
  salons.map((s, i) => {
    const area = JAIPUR_AREAS[i % JAIPUR_AREAS.length];
    const jitterLat = (((i * 37) % 11) - 5) * 0.0025;
    const jitterLng = (((i * 53) % 13) - 6) * 0.0025;
    return {
      ...s,
      location: {
        ...s.location,
        area: area.name,
        city: 'Jaipur',
        address: `${s.location.address.split(',')[0]}, ${area.name}, Jaipur`,
        latitude: area.lat + jitterLat,
        longitude: area.lng + jitterLng,
      },
    };
  });

interface JaipurNetworkMapProps {
  salons: Salon[];
  onOpenSalon?: (salon: Salon) => void;
  onBookSalon?: (salon: Salon) => void;
  className?: string;
}

export const JaipurNetworkMap: React.FC<JaipurNetworkMapProps> = ({ salons, onOpenSalon, onBookSalon, className = '' }) => {
  const placed = useMemo(() => placeSalonsInJaipur(salons), [salons]);
  const [filter, setFilter] = useState<MapCategoryFilter>('all');
  const [area, setArea] = useState<string>('all');
  const [openNow, setOpenNow] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const dragRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const visible = useMemo(() => {
    const f = FILTERS.find((x) => x.id === filter)!;
    return placed.filter((s) => f.match(s) && (area === 'all' || s.location.area === area) && (!openNow || s.isOpen));
  }, [placed, filter, area, openNow]);

  const selected = visible.find((s) => s.id === selectedId) ?? null;

  const clampPan = (p: { x: number; y: number }, z: number) => {
    const maxX = (VIEW.w * (z - 1)) / 2;
    const maxY = (VIEW.h * (z - 1)) / 2;
    return { x: Math.max(-maxX, Math.min(maxX, p.x)), y: Math.max(-maxY, Math.min(maxY, p.y)) };
  };
  const changeZoom = (delta: number) => {
    const z = Math.max(1, Math.min(3, Math.round((zoom + delta) * 10) / 10));
    setZoom(z);
    setPan((p) => clampPan(p, z));
  };
  const reset = () => { setZoom(1); setPan({ x: 0, y: 0 }); setSelectedId(null); };
  const focusOn = (s: Salon) => {
    const { x, y } = project(s.location.latitude, s.location.longitude);
    const z = Math.max(zoom, 1.8);
    setZoom(z);
    setPan(clampPan({ x: (VIEW.w / 2 - x) * z, y: (VIEW.h / 2 - y) * z }, z));
    setSelectedId(s.id);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    setPan(clampPan({ x: dragRef.current.px + dx, y: dragRef.current.py + dy }, zoom));
  };
  const onPointerUp = () => { dragRef.current = null; };

  const areaCounts = useMemo(() => {
    const m = new Map<string, number>();
    placed.forEach((s) => m.set(s.location.area, (m.get(s.location.area) ?? 0) + 1));
    return m;
  }, [placed]);

  return (
    <section
      className={`pt-8 border-t border-outline-variant/30 flex flex-col gap-6 ${className}`}
      aria-labelledby="map-heading"
      data-testid="jaipur-network-map"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-primary">Jaipur Salon Network</span>
          <h2 id="map-heading" className="text-2xl sm:text-3xl font-extrabold tracking-tight text-on-surface mt-1">
            {placed.length} Smart Salons Across the Pink City
          </h2>
          <p className="text-sm text-on-surface-variant mt-1">
            Filter by service or neighbourhood, tap a marker to preview, and book straight from the map.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-secondary">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span data-testid="map-visible-count">{visible.length} of {placed.length} shown</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1" role="tablist" aria-label="Filter salons by service">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => { setFilter(f.id); setSelectedId(null); }}
              className={`shrink-0 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                filter === f.id
                  ? 'bg-primary text-on-primary border-primary shadow-md shadow-primary/25'
                  : 'bg-white text-on-surface border-outline-variant/50 hover:border-primary/60'
              }`}
              data-testid={`map-filter-${f.id}`}
            >
              <span className="material-symbols-outlined text-base">{f.icon}</span>
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <label className="relative">
            <span className="sr-only">Neighbourhood</span>
            <select
              value={area}
              onChange={(e) => { setArea(e.target.value); setSelectedId(null); }}
              className="h-9 pl-8 pr-8 rounded-full text-xs font-bold bg-white border border-outline-variant/50 appearance-none cursor-pointer focus:outline-none focus:border-primary"
              data-testid="map-area-select"
            >
              <option value="all">All neighbourhoods</option>
              {JAIPUR_AREAS.map((a) => (
                <option key={a.name} value={a.name}>{a.name} ({areaCounts.get(a.name) ?? 0})</option>
              ))}
            </select>
            <span className="material-symbols-outlined text-base absolute left-2.5 top-1/2 -translate-y-1/2 text-primary pointer-events-none">location_on</span>
            <span className="material-symbols-outlined text-base absolute right-2 top-1/2 -translate-y-1/2 text-secondary pointer-events-none">expand_more</span>
          </label>
          <button
            type="button"
            onClick={() => setOpenNow((v) => !v)}
            aria-pressed={openNow}
            className={`h-9 px-3.5 rounded-full text-xs font-bold border inline-flex items-center gap-1.5 transition-all cursor-pointer ${
              openNow ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-outline-variant/50 hover:border-emerald-500'
            }`}
          >
            <span className="material-symbols-outlined text-base">schedule</span> Open now
          </button>
        </div>
      </div>

      {/* Map + list */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 relative rounded-3xl overflow-hidden border border-outline-variant/40 bg-[#fdf6f2] shadow-xl shadow-primary/5 aspect-[4/3] sm:aspect-[10/7] select-none">
          <div
            className="absolute inset-0 cursor-grab active:cursor-grabbing touch-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onWheel={(e) => { if (e.ctrlKey || Math.abs(e.deltaY) > 0) { e.preventDefault(); changeZoom(e.deltaY < 0 ? 0.2 : -0.2); } }}
          >
            <svg
              viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
              className="w-full h-full"
              role="img"
              aria-label="Schematic map of Jaipur with salon locations"
              data-testid="map-svg"
            >
              <g style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '50% 50%', transition: dragRef.current ? 'none' : 'transform 0.45s cubic-bezier(0.22,1,0.36,1)' }}>
                {/* Base layer */}
                <rect width={VIEW.w} height={VIEW.h} fill="#fdf6f2" />
                <g stroke="#e8d3cf" strokeWidth="1">
                  {Array.from({ length: 17 }).map((_, i) => <line key={`v${i}`} x1={i * 50} y1={0} x2={i * 50} y2={VIEW.h} />)}
                  {Array.from({ length: 12 }).map((_, i) => <line key={`h${i}`} x1={0} y1={i * 50} x2={VIEW.w} y2={i * 50} />)}
                </g>
                {/* Green areas */}
                <ellipse cx={620} cy={80} rx={120} ry={60} fill="#dcecd6" opacity={0.8} />
                <ellipse cx={140} cy={470} rx={90} ry={50} fill="#dcecd6" opacity={0.8} />
                <ellipse cx={470} cy={300} rx={55} ry={40} fill="#dcecd6" opacity={0.9} />
                {/* Pink city walled area */}
                <rect x={500} y={90} width={120} height={95} rx={6} fill="#f9d7dc" stroke="#e7a3b0" strokeWidth={2} strokeDasharray="6 4" />
                {/* Roads */}
                <g fill="none" stroke="#ffffff" strokeWidth={10} strokeLinecap="round">
                  <path d="M 0 250 C 200 230, 400 260, 800 240" />
                  <path d="M 380 0 C 400 200, 360 380, 420 560" />
                  <path d="M 60 120 C 250 120, 500 130, 780 90" />
                  <path d="M 100 560 C 200 420, 500 430, 700 560" />
                  <path d="M 700 0 C 660 200, 690 400, 640 560" />
                </g>
                <g fill="none" stroke="#f0b9c4" strokeWidth={3} strokeLinecap="round">
                  <path d="M 0 250 C 200 230, 400 260, 800 240" />
                  <path d="M 380 0 C 400 200, 360 380, 420 560" />
                  <path d="M 60 120 C 250 120, 500 130, 780 90" />
                  <path d="M 100 560 C 200 420, 500 430, 700 560" />
                  <path d="M 700 0 C 660 200, 690 400, 640 560" />
                </g>
                {/* Area labels */}
                {JAIPUR_AREAS.map((a) => {
                  const { x, y } = project(a.lat, a.lng);
                  return (
                    <text key={a.name} x={x} y={y - 22} textAnchor="middle" fontSize={11} fontFamily="Inter, sans-serif" fontWeight={700} fill="#8c7074" letterSpacing={0.5} opacity={area === 'all' || area === a.name ? 1 : 0.3} style={{ pointerEvents: 'none' }}>
                      {a.name.toUpperCase()}
                    </text>
                  );
                })}

                {/* Markers */}
                {visible.map((s, i) => {
                  const { x, y } = project(s.location.latitude, s.location.longitude);
                  const isSel = s.id === selectedId;
                  const isHover = s.id === hoverId;
                  return (
                    <g
                      key={s.id}
                      transform={`translate(${x} ${y})`}
                      onClick={(e) => { e.stopPropagation(); focusOn(s); }}
                      onMouseEnter={() => setHoverId(s.id)}
                      onMouseLeave={() => setHoverId(null)}
                      className="cursor-pointer"
                      data-testid={`map-marker-${s.id}`}
                      role="button"
                      aria-label={`${s.name}, ${s.location.area}`}
                    >
                      {isSel && <circle r={18} fill="#a30046" opacity={0.25} className="animate-pulse-ring" style={{ transformOrigin: 'center', transformBox: 'fill-box' }} />}
                      <motion.g
                        initial={{ scale: 0, y: -10 }}
                        animate={{ scale: isSel || isHover ? 1.25 : 1, y: 0 }}
                        transition={{ type: 'spring', stiffness: 260, damping: 18, delay: i * 0.03 }}
                        style={{ transformOrigin: '0 0' }}
                      >
                        <path d="M0 -26 C -9 -26 -14 -19 -14 -12 C -14 -3 0 8 0 8 C 0 8 14 -3 14 -12 C 14 -19 9 -26 0 -26 Z" fill={isSel ? '#a30046' : '#780032'} stroke="#fff" strokeWidth={2} />
                        <circle cy={-13} r={5} fill="#fff" />
                        <ellipse cy={9} rx={6} ry={2} fill="#000" opacity={0.15} />
                      </motion.g>
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>

          {/* Controls */}
          <div className="absolute right-3 top-3 flex flex-col gap-1.5" data-testid="map-controls">
            <button type="button" onClick={() => changeZoom(0.4)} aria-label="Zoom in" className="w-9 h-9 rounded-xl bg-white/90 backdrop-blur border border-outline-variant/40 shadow hover:bg-primary hover:text-white transition-colors flex items-center justify-center cursor-pointer"><span className="material-symbols-outlined text-lg">add</span></button>
            <button type="button" onClick={() => changeZoom(-0.4)} aria-label="Zoom out" className="w-9 h-9 rounded-xl bg-white/90 backdrop-blur border border-outline-variant/40 shadow hover:bg-primary hover:text-white transition-colors flex items-center justify-center cursor-pointer"><span className="material-symbols-outlined text-lg">remove</span></button>
            <button type="button" onClick={reset} aria-label="Reset map view" className="w-9 h-9 rounded-xl bg-white/90 backdrop-blur border border-outline-variant/40 shadow hover:bg-primary hover:text-white transition-colors flex items-center justify-center cursor-pointer"><span className="material-symbols-outlined text-lg">my_location</span></button>
          </div>
          <div className="absolute left-3 top-3 text-[10px] font-mono font-bold px-2 py-1 rounded-lg bg-white/90 backdrop-blur border border-outline-variant/40 shadow" data-testid="map-zoom">
            {zoom.toFixed(1)}×
          </div>
          <div className="absolute left-3 bottom-3 text-[10px] text-secondary bg-white/80 backdrop-blur px-2 py-1 rounded-lg border border-outline-variant/30">
            Schematic preview · live tiles coming soon
          </div>

          {/* Selected popover */}
          <AnimatePresence>
            {selected && (
              <motion.div
                key={selected.id}
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="absolute right-3 bottom-3 left-3 sm:left-auto sm:w-72 rounded-2xl bg-white border border-outline-variant/40 shadow-2xl overflow-hidden"
                data-testid="map-popover"
              >
                <div className="relative h-24">
                  <img src={selected.image} alt={selected.name} className="w-full h-full object-cover" />
                  <button type="button" onClick={() => setSelectedId(null)} aria-label="Close" className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center cursor-pointer"><span className="material-symbols-outlined text-base">close</span></button>
                  {selected.discountOffer && <span className="absolute bottom-2 left-2 text-[10px] font-bold bg-primary text-white px-2 py-0.5 rounded-full">{selected.discountOffer}</span>}
                </div>
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-sm text-on-surface leading-tight">{selected.name}</h4>
                      <p className="text-[11px] text-on-surface-variant">{selected.location.area} · {selected.distance}</p>
                    </div>
                    <span className="inline-flex items-center gap-0.5 text-xs font-bold text-amber-600"><span className="material-symbols-outlined text-sm fill-1">star</span>{selected.rating}</span>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button type="button" onClick={() => onOpenSalon?.(selected)} className="flex-1 h-9 rounded-xl border border-outline-variant/50 text-xs font-bold hover:bg-surface-container transition-colors cursor-pointer">Details</button>
                    <button type="button" onClick={() => onBookSalon?.(selected)} className="flex-1 h-9 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary-container transition-colors cursor-pointer">Book now</button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* List */}
        <div className="rounded-3xl border border-outline-variant/40 bg-white p-3 flex flex-col gap-2 max-h-[420px] lg:max-h-none overflow-y-auto no-scrollbar" data-testid="map-list">
          {visible.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-sm text-on-surface-variant">
              <span className="material-symbols-outlined text-4xl text-outline-variant mb-2">search_off</span>
              No salons match these filters yet.
              <button type="button" onClick={() => { setFilter('all'); setArea('all'); setOpenNow(false); }} className="mt-3 text-primary text-xs font-bold hover:underline cursor-pointer">Clear filters</button>
            </div>
          )}
          {visible.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => focusOn(s)}
              onMouseEnter={() => setHoverId(s.id)}
              onMouseLeave={() => setHoverId(null)}
              className={`floating-card text-left flex items-center gap-3 p-2.5 rounded-2xl border transition-colors cursor-pointer ${
                s.id === selectedId ? 'border-primary bg-primary/5' : 'border-transparent hover:border-outline-variant/50'
              }`}
              data-testid={`map-list-${s.id}`}
            >
              <img src={s.image} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" loading="lazy" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-on-surface truncate">{s.name}</span>
                  <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-amber-600 shrink-0"><span className="material-symbols-outlined text-xs fill-1">star</span>{s.rating}</span>
                </div>
                <div className="text-[11px] text-on-surface-variant truncate">{s.location.area} · {s.distance} · {s.priceRange}</div>
              </div>
              <span className="material-symbols-outlined text-primary text-lg shrink-0">chevron_right</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};
