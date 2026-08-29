import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { Appointment, SalonService } from '../types';

export interface MonthlySpendData {
  monthKey: string; // e.g. "2025-01"
  label: string; // e.g. "Jan '25"
  fullMonth: string; // e.g. "January 2025"
  totalSpend: number;
  advancePaid: number;
  balancePaid: number;
  appointmentCount: number;
  servicesCount: number;
  topSalon: string;
  topCategory: string;
}

export interface CategorySpendData {
  category: string;
  label: string;
  amount: number;
  percentage: number;
  count: number;
  color: string;
}

interface PaymentOverviewDashboardProps {
  appointments?: Appointment[];
  userName?: string;
  onNavigateToBooking?: () => void;
  onViewAppointments?: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  hair: '#b00055', // Nexora brand crimson
  skin: '#0284c7', // Sky blue
  spa: '#059669', // Emerald
  grooming: '#d97706', // Amber
  nails: '#7c3aed', // Purple
  bridal: '#e11d48', // Rose
  other: '#64748b', // Slate
};

const CATEGORY_LABELS: Record<string, string> = {
  hair: 'Hair & Styling',
  skin: 'Skin & Facials',
  spa: 'Spa & Wellness',
  grooming: "Men's Grooming",
  nails: 'Nails & Art',
  bridal: 'Bridal & Makeup',
  other: 'Other Services',
};

// Helper to extract or fallback months for D3 visualizations
function generateMonthlyAggregates(completedAppointments: Appointment[]): MonthlySpendData[] {
  const map = new Map<string, {
    totalSpend: number;
    advancePaid: number;
    balancePaid: number;
    appointmentCount: number;
    servicesCount: number;
    salonFrequency: Record<string, number>;
    categoryFrequency: Record<string, number>;
    dateObj: Date;
  }>();

  // If no appointments exist, generate last 6 months zeroed template
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    map.set(key, {
      totalSpend: 0,
      advancePaid: 0,
      balancePaid: 0,
      appointmentCount: 0,
      servicesCount: 0,
      salonFrequency: {},
      categoryFrequency: {},
      dateObj: d,
    });
  }

  // Aggregate actual appointments (both completed and confirmed with paid advances)
  completedAppointments.forEach((apt) => {
    let aptDate = new Date(apt.date || apt.createdAt);
    if (isNaN(aptDate.getTime())) {
      aptDate = new Date();
    }
    const key = `${aptDate.getFullYear()}-${String(aptDate.getMonth() + 1).padStart(2, '0')}`;

    const total = apt.totalPrice || 0;
    const advance = apt.advancePaid ?? (apt.paymentStatus === 'paid' ? Math.round(total * 0.25) : 0);
    const balance = Math.max(0, total - advance);

    if (!map.has(key)) {
      map.set(key, {
        totalSpend: 0,
        advancePaid: 0,
        balancePaid: 0,
        appointmentCount: 0,
        servicesCount: 0,
        salonFrequency: {},
        categoryFrequency: {},
        dateObj: new Date(aptDate.getFullYear(), aptDate.getMonth(), 1),
      });
    }

    const curr = map.get(key)!;
    curr.totalSpend += total;
    curr.advancePaid += advance;
    curr.balancePaid += balance;
    curr.appointmentCount += 1;
    curr.servicesCount += apt.services?.length || 1;

    if (apt.salonName) {
      curr.salonFrequency[apt.salonName] = (curr.salonFrequency[apt.salonName] || 0) + 1;
    }

    apt.services?.forEach((s) => {
      const cat = s.category || 'hair';
      curr.categoryFrequency[cat] = (curr.categoryFrequency[cat] || 0) + 1;
    });
  });

  // Sort keys chronologically
  const sortedKeys = Array.from(map.keys()).sort();

  return sortedKeys.map((key) => {
    const data = map.get(key)!;
    const d = data.dateObj;
    const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    const fullMonth = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    // Find top salon
    let topSalon = 'None';
    let maxSalonCount = 0;
    Object.entries(data.salonFrequency).forEach(([salon, count]) => {
      if (count > maxSalonCount) {
        maxSalonCount = count;
        topSalon = salon;
      }
    });

    // Find top category
    let topCategory = 'None';
    let maxCatCount = 0;
    Object.entries(data.categoryFrequency).forEach(([cat, count]) => {
      if (count > maxCatCount) {
        maxCatCount = count;
        topCategory = CATEGORY_LABELS[cat] || cat;
      }
    });

    return {
      monthKey: key,
      label,
      fullMonth,
      totalSpend: data.totalSpend,
      advancePaid: data.advancePaid,
      balancePaid: data.balancePaid,
      appointmentCount: data.appointmentCount,
      servicesCount: data.servicesCount,
      topSalon,
      topCategory,
    };
  });
}

export const PaymentOverviewDashboard: React.FC<PaymentOverviewDashboardProps> = ({
  appointments = [],
  userName = 'Customer',
  onNavigateToBooking,
  onViewAppointments,
}) => {
  const [timeRange, setTimeRange] = useState<'6m' | '12m' | 'all'>('6m');
  const [activeMetric, setActiveMetric] = useState<'total' | 'advance' | 'balance'>('total');
  const [hoveredMonth, setHoveredMonth] = useState<MonthlySpendData | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<MonthlySpendData | null>(null);

  const trendSvgRef = useRef<SVGSVGElement | null>(null);
  const donutSvgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Filter completed and advance-paid appointments
  const completedOrPaidAppointments = useMemo(() => {
    return appointments.filter(
      (a) =>
        a.status === 'completed' ||
        a.paymentStatus === 'paid' ||
        (a.advancePaid && a.advancePaid > 0)
    );
  }, [appointments]);

  const hasData = completedOrPaidAppointments.length > 0;

  // Monthly Aggregates
  const rawMonthlyData = useMemo(() => {
    return generateMonthlyAggregates(completedOrPaidAppointments);
  }, [completedOrPaidAppointments]);

  // Sliced monthly data based on time range
  const monthlyData = useMemo(() => {
    if (timeRange === '6m') return rawMonthlyData.slice(-6);
    if (timeRange === '12m') return rawMonthlyData.slice(-12);
    return rawMonthlyData;
  }, [rawMonthlyData, timeRange]);

  // Overall KPI metrics
  const kpiMetrics = useMemo(() => {
    const totalSpend = completedOrPaidAppointments.reduce((sum, a) => sum + (a.totalPrice || 0), 0);
    const totalAdvancePaid = completedOrPaidAppointments.reduce((sum, a) => {
      const adv = a.advancePaid ?? (a.paymentStatus === 'paid' ? Math.round((a.totalPrice || 0) * 0.25) : 0);
      return sum + adv;
    }, 0);
    const totalRemainingDue = Math.max(0, totalSpend - totalAdvancePaid);
    const completedCount = completedOrPaidAppointments.filter((a) => a.status === 'completed').length;
    const confirmedCount = completedOrPaidAppointments.filter((a) => a.status === 'confirmed').length;
    const avgTicket = completedOrPaidAppointments.length > 0
      ? Math.round(totalSpend / completedOrPaidAppointments.length)
      : 0;

    return {
      totalSpend,
      totalAdvancePaid,
      totalRemainingDue,
      completedCount,
      confirmedCount,
      totalBookings: completedOrPaidAppointments.length,
      avgTicket,
    };
  }, [completedOrPaidAppointments]);

  // Category Spend Distribution
  const categoryData = useMemo<CategorySpendData[]>(() => {
    const catMap: Record<string, { amount: number; count: number }> = {};
    let grandTotal = 0;

    completedOrPaidAppointments.forEach((apt) => {
      apt.services?.forEach((s: SalonService) => {
        const cat = s.category || 'hair';
        const cost = s.discountPrice || s.price || 0;
        if (!catMap[cat]) {
          catMap[cat] = { amount: 0, count: 0 };
        }
        catMap[cat].amount += cost;
        catMap[cat].count += 1;
        grandTotal += cost;
      });
    });

    if (grandTotal === 0) {
      return [];
    }

    return Object.entries(catMap)
      .map(([cat, val]) => ({
        category: cat,
        label: CATEGORY_LABELS[cat] || cat,
        amount: val.amount,
        percentage: Math.round((val.amount / grandTotal) * 100),
        count: val.count,
        color: CATEGORY_COLORS[cat] || CATEGORY_COLORS.other,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [completedOrPaidAppointments]);

  // =========================================================================
  // D3 SPENDING TRENDS BAR & LINE CHART
  // =========================================================================
  useEffect(() => {
    if (!trendSvgRef.current || monthlyData.length === 0) return;

    const svg = d3.select(trendSvgRef.current);
    svg.selectAll('*').remove();

    const width = 640;
    const height = 260;
    const margin = { top: 25, right: 25, bottom: 40, left: 55 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Responsive SVG viewBox
    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('preserveAspectRatio', 'xMidYMid meet');

    // Defs for gradients & shadow filters
    const defs = svg.append('defs');

    // Bar gradient (Primary to Crimson)
    const barGradient = defs
      .append('linearGradient')
      .attr('id', 'bar-gradient-primary')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    barGradient.append('stop').attr('offset', '0%').attr('stop-color', '#b00055').attr('stop-opacity', 0.95);
    barGradient.append('stop').attr('offset', '100%').attr('stop-color', '#d81b60').attr('stop-opacity', 0.65);

    // Advance payment bar gradient (Emerald/Teal)
    const advGradient = defs
      .append('linearGradient')
      .attr('id', 'bar-gradient-advance')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    advGradient.append('stop').attr('offset', '0%').attr('stop-color', '#059669').attr('stop-opacity', 0.95);
    advGradient.append('stop').attr('offset', '100%').attr('stop-color', '#10b981').attr('stop-opacity', 0.65);

    // Trend Area Gradient
    const areaGradient = defs
      .append('linearGradient')
      .attr('id', 'trend-area-gradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    areaGradient.append('stop').attr('offset', '0%').attr('stop-color', '#b00055').attr('stop-opacity', 0.25);
    areaGradient.append('stop').attr('offset', '100%').attr('stop-color', '#b00055').attr('stop-opacity', 0.0);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // X scale (ScaleBand)
    const x = d3
      .scaleBand()
      .domain(monthlyData.map((d) => d.label))
      .range([0, innerWidth])
      .padding(0.35);

    // Y scale (ScaleLinear)
    const maxVal = d3.max(monthlyData, (d) => Math.max(d.totalSpend, d.advancePaid, 1000)) || 2000;
    const y = d3
      .scaleLinear()
      .domain([0, maxVal * 1.15])
      .nice()
      .range([innerHeight, 0]);

    // Gridlines (Horizontal)
    g.append('g')
      .attr('class', 'grid-lines')
      .selectAll('line')
      .data(y.ticks(4))
      .enter()
      .append('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', (d) => y(d))
      .attr('y2', (d) => y(d))
      .attr('stroke', 'currentColor')
      .attr('stroke-opacity', 0.08)
      .attr('stroke-dasharray', '3,3');

    // Area generator for trend
    const areaGenerator = d3
      .area<MonthlySpendData>()
      .x((d) => (x(d.label) || 0) + x.bandwidth() / 2)
      .y0(innerHeight)
      .y1((d) => y(d.totalSpend))
      .curve(d3.curveMonotoneX);

    // Line generator for trend
    const lineGenerator = d3
      .line<MonthlySpendData>()
      .x((d) => (x(d.label) || 0) + x.bandwidth() / 2)
      .y((d) => y(d.totalSpend))
      .curve(d3.curveMonotoneX);

    // Draw Smooth Area
    g.append('path')
      .datum(monthlyData)
      .attr('fill', 'url(#trend-area-gradient)')
      .attr('d', areaGenerator);

    // Draw Smooth Line
    g.append('path')
      .datum(monthlyData)
      .attr('fill', 'none')
      .attr('stroke', '#b00055')
      .attr('stroke-width', 2.5)
      .attr('stroke-linecap', 'round')
      .attr('d', lineGenerator);

    // Draw Bars (Total Spend or Advance Paid)
    const barGroups = g
      .selectAll('.bar-group')
      .data(monthlyData)
      .enter()
      .append('g')
      .attr('class', 'bar-group')
      .attr('transform', (d) => `translate(${x(d.label) || 0}, 0)`);

    // Total Spend Bars
    barGroups
      .append('rect')
      .attr('class', 'total-bar')
      .attr('x', 0)
      .attr('y', (d) => y(d.totalSpend))
      .attr('width', x.bandwidth())
      .attr('height', (d) => Math.max(0, innerHeight - y(d.totalSpend)))
      .attr('rx', 4)
      .attr('fill', 'url(#bar-gradient-primary)')
      .attr('opacity', activeMetric === 'total' ? 0.9 : 0.45)
      .attr('cursor', 'pointer')
      .on('mouseenter', (_, d) => setHoveredMonth(d))
      .on('mouseleave', () => setHoveredMonth(null))
      .on('click', (_, d) => setSelectedMonth(d));

    // Advance Paid Overlay Bar (Inside total bar or side bar)
    barGroups
      .append('rect')
      .attr('class', 'advance-bar')
      .attr('x', x.bandwidth() * 0.15)
      .attr('y', (d) => y(d.advancePaid))
      .attr('width', x.bandwidth() * 0.7)
      .attr('height', (d) => Math.max(0, innerHeight - y(d.advancePaid)))
      .attr('rx', 3)
      .attr('fill', 'url(#bar-gradient-advance)')
      .attr('opacity', activeMetric === 'advance' ? 0.95 : 0.7)
      .attr('cursor', 'pointer')
      .on('mouseenter', (_, d) => setHoveredMonth(d))
      .on('mouseleave', () => setHoveredMonth(null))
      .on('click', (_, d) => setSelectedMonth(d));

    // Interactive Data Points / Circles on the Line
    g.selectAll('.data-circle')
      .data(monthlyData)
      .enter()
      .append('circle')
      .attr('cx', (d) => (x(d.label) || 0) + x.bandwidth() / 2)
      .attr('cy', (d) => y(d.totalSpend))
      .attr('r', (d) => (hoveredMonth?.monthKey === d.monthKey ? 6 : 4))
      .attr('fill', '#ffffff')
      .attr('stroke', '#b00055')
      .attr('stroke-width', 2.5)
      .attr('cursor', 'pointer')
      .on('mouseenter', (_, d) => setHoveredMonth(d))
      .on('mouseleave', () => setHoveredMonth(null))
      .on('click', (_, d) => setSelectedMonth(d));

    // Top value badges on bars if spend > 0
    barGroups
      .filter((d) => d.totalSpend > 0)
      .append('text')
      .attr('x', x.bandwidth() / 2)
      .attr('y', (d) => y(d.totalSpend) - 6)
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('font-weight', '700')
      .attr('fill', 'currentColor')
      .attr('opacity', 0.85)
      .text((d) => `₹${d.totalSpend >= 1000 ? (d.totalSpend / 1000).toFixed(1) + 'k' : d.totalSpend}`);

    // X Axis
    const xAxis = d3.axisBottom(x).tickSize(0).tickPadding(10);
    const gx = g
      .append('g')
      .attr('transform', `translate(0, ${innerHeight})`)
      .call(xAxis);

    gx.select('.domain').attr('stroke', 'currentColor').attr('stroke-opacity', 0.2);
    gx.selectAll('text')
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .attr('fill', 'currentColor')
      .attr('opacity', 0.85);

    // Y Axis with ₹ currency formatting
    const yAxis = d3
      .axisLeft(y)
      .ticks(4)
      .tickFormat((d) => {
        const num = Number(d);
        if (num >= 1000) return `₹${(num / 1000).toFixed(0)}k`;
        return `₹${num}`;
      })
      .tickSize(0)
      .tickPadding(8);

    const gy = g.append('g').call(yAxis);
    gy.select('.domain').remove();
    gy.selectAll('text')
      .attr('font-size', '10px')
      .attr('font-weight', '600')
      .attr('fill', 'currentColor')
      .attr('opacity', 0.7);
  }, [monthlyData, activeMetric, hoveredMonth]);

  // =========================================================================
  // D3 CATEGORY SPEND DONUT CHART
  // =========================================================================
  useEffect(() => {
    if (!donutSvgRef.current || categoryData.length === 0) return;

    const svg = d3.select(donutSvgRef.current);
    svg.selectAll('*').remove();

    const size = 180;
    const radius = size / 2;
    const innerRadius = radius * 0.62;

    svg.attr('viewBox', `0 0 ${size} ${size}`).attr('preserveAspectRatio', 'xMidYMid meet');

    const g = svg.append('g').attr('transform', `translate(${radius}, ${radius})`);

    const pie = d3
      .pie<CategorySpendData>()
      .value((d) => d.amount)
      .sort(null)
      .padAngle(0.03);

    const arc = d3
      .arc<d3.PieArcDatum<CategorySpendData>>()
      .innerRadius(innerRadius)
      .outerRadius(radius - 6)
      .cornerRadius(4);

    const arcs = g
      .selectAll('.arc')
      .data(pie(categoryData))
      .enter()
      .append('g')
      .attr('class', 'arc');

    arcs
      .append('path')
      .attr('d', arc)
      .attr('fill', (d) => d.data.color)
      .attr('cursor', 'pointer')
      .attr('opacity', 0.9)
      .on('mouseenter', function () {
        d3.select(this).transition().duration(150).attr('opacity', 1).attr('transform', 'scale(1.04)');
      })
      .on('mouseleave', function () {
        d3.select(this).transition().duration(150).attr('opacity', 0.9).attr('transform', 'scale(1)');
      });

    // Center Summary in Donut
    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '-0.2em')
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .attr('fill', 'currentColor')
      .attr('opacity', 0.7)
      .text('Total Spent');

    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '1em')
      .attr('font-size', '14px')
      .attr('font-weight', '800')
      .attr('fill', '#b00055')
      .text(`₹${kpiMetrics.totalSpend.toLocaleString('en-IN')}`);
  }, [categoryData, kpiMetrics.totalSpend]);

  return (
    <div
      id="payment-overview-dashboard"
      ref={containerRef}
      className="bg-surface-container-low border border-outline-variant/50 rounded-2xl p-4 sm:p-5 shadow-xs mb-4 flex flex-col gap-4 text-on-surface"
    >
      {/* ========================================================================= */}
      {/* 1. SECTION HEADER WITH CONTROLS & RANGE SELECTOR                          */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-outline-variant/30 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#b00055]/20 to-primary/20 text-[#b00055] flex items-center justify-center shadow-xs ring-4 ring-[#b00055]/10">
            <span className="material-symbols-outlined text-[22px]">analytics</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-card-title text-[17px] font-bold text-on-surface">
                Payment & Spending Overview
              </h3>
              <span className="text-[10px] bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-extrabold px-2 py-0.5 rounded-full border border-emerald-500/30">
                D3.js Live Analytics
              </span>
            </div>
            <p className="text-[11px] text-on-surface-variant">
              Visualizing monthly salon spending trends, completed appointments & advance deposits
            </p>
          </div>
        </div>

        {/* Time Range Selector */}
        <div className="flex items-center gap-1 bg-surface-container-lowest p-1 rounded-xl border border-outline-variant/40 self-stretch sm:self-auto justify-center">
          <button
            type="button"
            id="trend-range-6m-btn"
            onClick={() => setTimeRange('6m')}
            className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
              timeRange === '6m'
                ? 'bg-primary text-white shadow-xs'
                : 'text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            Last 6M
          </button>
          <button
            type="button"
            id="trend-range-12m-btn"
            onClick={() => setTimeRange('12m')}
            className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
              timeRange === '12m'
                ? 'bg-primary text-white shadow-xs'
                : 'text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            Last 12M
          </button>
          <button
            type="button"
            id="trend-range-all-btn"
            onClick={() => setTimeRange('all')}
            className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
              timeRange === 'all'
                ? 'bg-primary text-white shadow-xs'
                : 'text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            All Time
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. TOP KPI CARDS (TOTAL SPEND, ADVANCE PAID, VISITS, AVG TICKET)           */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {/* Total Salon Spend */}
        <div
          onClick={() => setActiveMetric('total')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
            activeMetric === 'total'
              ? 'bg-primary/10 border-primary ring-2 ring-primary/30 shadow-xs'
              : 'bg-surface-container-lowest border-outline-variant/40 hover:bg-surface-container'
          }`}
        >
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Spend</span>
            <span className="material-symbols-outlined text-[18px] text-[#b00055]">payments</span>
          </div>
          <div className="mt-2">
            <span className="text-[20px] sm:text-[22px] font-black text-on-surface block">
              ₹{kpiMetrics.totalSpend.toLocaleString('en-IN')}
            </span>
            <span className="text-[10px] text-on-surface-variant font-medium mt-0.5 block">
              Across {kpiMetrics.totalBookings} appointments
            </span>
          </div>
        </div>

        {/* 25% Advance Paid Online */}
        <div
          onClick={() => setActiveMetric('advance')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
            activeMetric === 'advance'
              ? 'bg-emerald-500/10 border-emerald-500 ring-2 ring-emerald-500/30 shadow-xs'
              : 'bg-surface-container-lowest border-outline-variant/40 hover:bg-surface-container'
          }`}
        >
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-[11px] font-bold uppercase tracking-wider">25% Advance Paid</span>
            <span className="material-symbols-outlined text-[18px] text-emerald-600">verified</span>
          </div>
          <div className="mt-2">
            <span className="text-[20px] sm:text-[22px] font-black text-emerald-700 dark:text-emerald-400 block">
              ₹{kpiMetrics.totalAdvancePaid.toLocaleString('en-IN')}
            </span>
            <span className="text-[10px] text-on-surface-variant font-medium mt-0.5 block">
              Paid securely via Razorpay
            </span>
          </div>
        </div>

        {/* 75% Remaining at Salon */}
        <div
          onClick={() => setActiveMetric('balance')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
            activeMetric === 'balance'
              ? 'bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/30 shadow-xs'
              : 'bg-surface-container-lowest border-outline-variant/40 hover:bg-surface-container'
          }`}
        >
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-[11px] font-bold uppercase tracking-wider">Counter Balance</span>
            <span className="material-symbols-outlined text-[18px] text-amber-600">storefront</span>
          </div>
          <div className="mt-2">
            <span className="text-[20px] sm:text-[22px] font-black text-amber-800 dark:text-amber-300 block">
              ₹{kpiMetrics.totalRemainingDue.toLocaleString('en-IN')}
            </span>
            <span className="text-[10px] text-on-surface-variant font-medium mt-0.5 block">
              75% settled at salon counter
            </span>
          </div>
        </div>

        {/* Completed Bookings & Avg Ticket */}
        <div className="p-3.5 rounded-2xl bg-surface-container-lowest border border-outline-variant/40 flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-[11px] font-bold uppercase tracking-wider">Avg. Visit Spend</span>
            <span className="material-symbols-outlined text-[18px] text-primary">receipt_long</span>
          </div>
          <div className="mt-2">
            <span className="text-[20px] sm:text-[22px] font-black text-primary block">
              ₹{kpiMetrics.avgTicket.toLocaleString('en-IN')}
            </span>
            <span className="text-[10px] text-on-surface-variant font-medium mt-0.5 block">
              {kpiMetrics.completedCount} completed visits
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. D3 MONTHLY SPENDING TREND CHART CARD                                   */}
      {/* ========================================================================= */}
      <div className="p-4 bg-surface-container-lowest rounded-2xl border border-outline-variant/40 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <h4 className="font-bold text-[14px] text-on-surface flex items-center gap-1.5">
              <span>Monthly Salon Spending Trend</span>
              <span className="text-[11px] font-normal text-on-surface-variant">
                (INR vs. Advance Deposits)
              </span>
            </h4>
            <p className="text-[11px] text-on-surface-variant">
              Hover over bars or nodes to inspect specific monthly receipts & bookings
            </p>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 text-[11px] font-bold flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-[#b00055]" />
              <span>Total Spend</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-[#059669]" />
              <span>25% Advance Paid</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-0.5 bg-[#b00055]" />
              <span>Trend Curve</span>
            </div>
          </div>
        </div>

        {/* D3 Canvas Container */}
        <div className="w-full relative min-h-[220px] flex items-center justify-center">
          <svg
            ref={trendSvgRef}
            className="w-full h-auto max-h-[260px] overflow-visible select-none"
          />

          {/* Interactive Hover Tooltip */}
          {hoveredMonth && (
            <div
              className="absolute top-2 right-2 sm:right-6 z-20 p-2.5 px-3 bg-surface-container-highest/95 backdrop-blur-md rounded-xl border border-[#b00055]/30 shadow-lg text-[11px] flex flex-col gap-1 pointer-events-none animate-in fade-in duration-100"
            >
              <div className="font-extrabold text-primary flex items-center justify-between gap-3 border-b border-outline-variant/30 pb-1">
                <span>{hoveredMonth.fullMonth}</span>
                <span>{hoveredMonth.appointmentCount} Booking(s)</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-on-surface-variant">Total Spent:</span>
                <span className="font-bold text-on-surface">₹{hoveredMonth.totalSpend.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-on-surface-variant">25% Advance:</span>
                <span className="font-bold text-emerald-600">₹{hoveredMonth.advancePaid.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-on-surface-variant">Salon Balance:</span>
                <span className="font-bold text-amber-600">₹{hoveredMonth.balancePaid.toLocaleString('en-IN')}</span>
              </div>
              {hoveredMonth.topSalon !== 'None' && (
                <div className="text-[10px] text-on-surface-variant pt-0.5 border-t border-outline-variant/20">
                  Favorite: <strong>{hoveredMonth.topSalon}</strong>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. CATEGORY DISTRIBUTION & COMPLETED VISITS BREAKDOWN                     */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Category Breakdown with D3 Donut */}
        <div className="p-4 bg-surface-container-lowest rounded-2xl border border-outline-variant/40 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-[14px] text-on-surface flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px] text-[#b00055]">pie_chart</span>
              <span>Category Spending Distribution</span>
            </h4>
            <span className="text-[11px] text-on-surface-variant font-medium">
              {categoryData.length} Categories
            </span>
          </div>

          {categoryData.length > 0 ? (
            <div className="flex flex-col sm:flex-row items-center gap-4 pt-1">
              <div className="shrink-0 w-36 h-36 flex items-center justify-center">
                <svg ref={donutSvgRef} className="w-full h-full" />
              </div>

              <div className="flex-1 w-full flex flex-col gap-2 max-h-44 overflow-y-auto pr-1">
                {categoryData.map((cat) => (
                  <div key={cat.category} className="flex flex-col gap-1 text-[11px]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 truncate">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="font-bold text-on-surface truncate">{cat.label}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono font-bold">₹{cat.amount.toLocaleString('en-IN')}</span>
                        <span className="text-on-surface-variant text-[10px]">({cat.percentage}%)</span>
                      </div>
                    </div>
                    {/* Visual progress bar */}
                    <div className="w-full h-1.5 rounded-full bg-surface-container overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${cat.percentage}%`,
                          backgroundColor: cat.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-on-surface-variant flex flex-col items-center gap-1.5 text-[12px]">
              <span className="material-symbols-outlined text-[28px] opacity-40">donut_small</span>
              <p className="font-semibold">No category spending recorded yet</p>
              <p className="text-[11px] opacity-80">
                Book haircut, spa, or grooming services to visualize category breakdown
              </p>
            </div>
          )}
        </div>

        {/* Completed Appointments Summary Card */}
        <div className="p-4 bg-surface-container-lowest rounded-2xl border border-outline-variant/40 flex flex-col justify-between gap-3">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-[14px] text-on-surface flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-emerald-600">task_alt</span>
                <span>Completed Appointments Ledger</span>
              </h4>
              {onViewAppointments && (
                <button
                  type="button"
                  onClick={onViewAppointments}
                  className="text-[11px] text-primary font-bold hover:underline cursor-pointer flex items-center gap-0.5"
                >
                  <span>View All</span>
                  <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                </button>
              )}
            </div>

            {completedOrPaidAppointments.length > 0 ? (
              <div className="flex flex-col gap-2 max-h-44 overflow-y-auto pr-1">
                {completedOrPaidAppointments.slice(0, 4).map((apt) => {
                  const advance = apt.advancePaid ?? (apt.paymentStatus === 'paid' ? Math.round((apt.totalPrice || 0) * 0.25) : 0);
                  const isCompleted = apt.status === 'completed';
                  return (
                    <div
                      key={apt.id}
                      className="p-2.5 rounded-xl bg-surface-container border border-outline-variant/30 flex items-center justify-between gap-2 text-[12px]"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-[14px] ${
                            isCompleted
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                              : 'bg-primary/15 text-primary'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            {isCompleted ? 'check_circle' : 'schedule'}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-on-surface truncate">{apt.salonName}</p>
                          <p className="text-[10px] text-on-surface-variant truncate">
                            {apt.date} · {apt.services?.[0]?.name || 'Service'}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-bold text-on-surface block">
                          ₹{(apt.totalPrice || 0).toLocaleString('en-IN')}
                        </span>
                        <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold block">
                          ₹{advance} adv. paid
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-on-surface-variant flex flex-col items-center gap-1.5 text-[12px]">
                <span className="material-symbols-outlined text-[28px] opacity-40">event_busy</span>
                <p className="font-semibold">No completed appointments yet</p>
                <p className="text-[11px] opacity-80">
                  Completed visits and advance payment receipts will appear in this ledger
                </p>
              </div>
            )}
          </div>

          {/* Action to book salon */}
          {onNavigateToBooking && (
            <button
              type="button"
              id="dashboard-book-salon-btn"
              onClick={onNavigateToBooking}
              className="w-full py-2 bg-gradient-to-r from-primary to-[#b00055] text-white text-[12px] font-bold rounded-xl shadow-xs hover:opacity-95 transition-opacity flex items-center justify-center gap-1.5 cursor-pointer mt-1"
            >
              <span className="material-symbols-outlined text-[16px]">calendar_add_on</span>
              <span>Book a Salon Appointment</span>
            </button>
          )}
        </div>
      </div>

      {/* Selected Month Modal/Drawer if clicked */}
      {selectedMonth && (
        <div className="p-3 bg-primary/10 rounded-xl border border-primary/30 flex items-center justify-between text-[12px] animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-primary">calendar_month</span>
            <span>
              <strong>{selectedMonth.fullMonth} Summary:</strong> Total ₹{selectedMonth.totalSpend.toLocaleString('en-IN')}{' '}
              (Advance Paid: ₹{selectedMonth.advancePaid.toLocaleString('en-IN')} · {selectedMonth.appointmentCount} Visits)
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedMonth(null)}
            className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
};
