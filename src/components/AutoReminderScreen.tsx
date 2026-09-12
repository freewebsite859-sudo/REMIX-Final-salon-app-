import React, { useState } from 'react';
import { AutoReminderConfig, ReminderFrequencyOption, CampaignStatus } from '../types';

interface AutoReminderScreenProps {
  onBack?: () => void;
  onSaveConfig?: (config: AutoReminderConfig) => void;
}

const DEFAULT_CONFIG: AutoReminderConfig = {
  isEnabled: false,
  status: 'draft',
  customerGroup: 'Inactive Customers (> 30 Days)',
  startDate: new Date().toISOString().split('T')[0],
  endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  sendTime: '10:00 AM',
  selectedOffer: '20% Off Hair Spa & Styling Package',
  messageTemplate:
    'Hi {{customer_name}}! 🌸 We miss seeing you at {{salon_name}}. Treat yourself to a relaxing pampering session! Use offer {{offer_name}} for your next visit. Book here: {{booking_link}} (Valid till {{expiry_date}}). Reply STOP to opt out.',
  maximumReminders: 3,
  frequency: '2_days',
  customDays: 4,
  stopAfterBooking: true,
  stopAfterOfferExpiry: true,
  skipRecentlyContacted: true,
  skipRecentlyContactedDays: 5,
  excludeUnsubscribed: true,
  businessHoursOnly: true,
  businessHoursStart: '09:00 AM',
  businessHoursEnd: '08:00 PM',
  campaignStats: {
    audienceCount: 142,
    sentCount: 38,
    bookedCount: 12,
    optOutCount: 0,
    conversionRate: 15.8,
  },
};

const CUSTOMER_GROUPS = [
  'Inactive Customers (> 30 Days)',
  'All Registered Customers (Consent Verified)',
  'Recent Visitors (Last 14 Days)',
  'High-Value VIP Clients',
  'Abandoned Booking Drafts',
  'New Leads (First Visit Pending)',
];

const OFFERS = [
  '20% Off Hair Spa & Styling Package',
  'Flat ₹300 Off Next Luxury Facial',
  'Free Express Head Massage with Haircut',
  'Buy 1 Get 1 Complimentary Manicure',
  'Custom Promotional Discount (15% Off)',
  'None — General Courtesy Check-in',
];

const TEMPLATE_PRESETS = [
  {
    name: 'Friendly Follow-up & Special Offer',
    template:
      'Hi {{customer_name}}! 🌸 We miss seeing you at {{salon_name}}. Treat yourself to a relaxing pampering session! Use offer {{offer_name}} for your next visit. Book here: {{booking_link}} (Valid till {{expiry_date}}). Reply STOP to opt out.',
  },
  {
    name: 'Exclusive VIP Discount',
    template:
      'Hello {{customer_name}} ✨ Special VIP treatment awaits you at {{salon_name}}! Enjoy {{offer_name}} on your upcoming visit. Book online in seconds: {{booking_link}}. Offer ends {{expiry_date}}.',
  },
  {
    name: 'Urgent Expiry Reminder',
    template:
      'Hey {{customer_name}}! ⏰ Your exclusive {{offer_name}} voucher at {{salon_name}} is expiring on {{expiry_date}}. Don’t miss out — reserve your spot now: {{booking_link}}.',
  },
];

export const AutoReminderScreen: React.FC<AutoReminderScreenProps> = ({ onBack, onSaveConfig }) => {
  const [config, setConfig] = useState<AutoReminderConfig>(DEFAULT_CONFIG);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isEditing, setIsEditing] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Helper to calculate timeline days based on frequency & max reminders
  const getTimelineSteps = () => {
    let intervalDays = 2;
    if (config.frequency === '3_days') intervalDays = 3;
    if (config.frequency === 'weekly') intervalDays = 7;
    if (config.frequency === 'custom') intervalDays = Math.max(1, config.customDays || 4);

    const steps = [
      {
        day: 1,
        title: 'Day 1 — First message',
        desc: 'Initial outreach & special offer announcement sent via WhatsApp.',
        badge: 'Initial Outreach',
        color: 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
      },
    ];

    const maxCount = Math.min(Math.max(1, config.maximumReminders), 5);
    for (let i = 1; i <= maxCount; i++) {
      const dayNum = 1 + i * intervalDays;
      const isFinal = i === maxCount;
      steps.push({
        day: dayNum,
        title: `Day ${dayNum} — ${isFinal ? 'Final reminder' : `Reminder ${i}`}`,
        desc: isFinal
          ? 'Final notice sent before offer expires or sequence ends automatically.'
          : `Follow-up WhatsApp reminder #${i} sent if customer has not booked yet.`,
        badge: isFinal ? 'Final Notice' : `Reminder #${i}`,
        color: isFinal
          ? 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300'
          : 'border-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-300',
      });
    }

    return steps;
  };

  const handleToggleMain = () => {
    if (!config.isEnabled) {
      // Opening warning modal before activation
      setShowWarningModal(true);
    } else {
      // Deactivating
      setConfig((prev) => ({
        ...prev,
        isEnabled: false,
        status: 'paused',
      }));
      showToast('Auto Reminder sequence paused.');
    }
  };

  const confirmActivation = () => {
    setShowWarningModal(false);
    setConfig((prev) => ({
      ...prev,
      isEnabled: true,
      status: 'active',
    }));
    if (onSaveConfig) onSaveConfig({ ...config, isEnabled: true, status: 'active' });
    showToast('Auto WhatsApp Reminder activated successfully!');
  };

  const handlePause = () => {
    setConfig((prev) => ({
      ...prev,
      isEnabled: false,
      status: 'paused',
    }));
    showToast('Campaign paused. You can resume at any time.');
  };

  const handleStopCampaign = () => {
    if (window.confirm('Are you sure you want to stop this campaign? All scheduled reminder queues will be cancelled.')) {
      setConfig((prev) => ({
        ...prev,
        isEnabled: false,
        status: 'stopped',
      }));
      showToast('Campaign stopped and cancelled.');
    }
  };

  const insertToken = (token: string) => {
    setConfig((prev) => ({
      ...prev,
      messageTemplate: prev.messageTemplate + ` ${token}`,
    }));
  };

  const renderFormattedPreview = (template: string) => {
    return template
      .replace(/{{customer_name}}/g, 'Ananya Sharma')
      .replace(/{{salon_name}}/g, 'Nexora Salon & Spa')
      .replace(/{{offer_name}}/g, config.selectedOffer)
      .replace(/{{booking_link}}/g, 'https://nexora.app/b/salon-1')
      .replace(/{{expiry_date}}/g, config.endDate);
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6 md:py-8 space-y-6 animate-in fade-in duration-200">
      {/* Toast notification */}
      {toastMessage && (
        <div className="fixed top-20 right-4 z-50 bg-surface-container-highest border border-outline-variant/50 text-on-surface px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 animate-in slide-in-from-top-2 duration-200">
          <span className="material-symbols-outlined text-emerald-500 text-[20px]">check_circle</span>
          <span className="text-xs md:text-sm font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Top Breadcrumb & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/30 pb-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-2 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
              title="Go Back"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold tracking-wider uppercase border border-emerald-500/20">
                SCREEN 10 — AUTOMATIC 2-DAY REMINDER
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  config.status === 'active'
                    ? 'bg-emerald-500 text-white animate-pulse'
                    : config.status === 'paused'
                    ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                    : 'bg-surface-container text-on-surface-variant'
                }`}
              >
                ● {config.status}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-on-surface tracking-tight mt-1 flex items-center gap-2">
              <span>Auto Reminder Settings</span>
              <span className="material-symbols-outlined text-emerald-500 text-[24px]">chat</span>
            </h1>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Automated WhatsApp follow-up sequence to re-engage past customers and boost repeat salon bookings.
            </p>
          </div>
        </div>

        {/* Action Header Button Group */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowPreviewModal(true)}
            className="px-3.5 py-2 rounded-xl border border-outline-variant/40 bg-surface-container-lowest hover:bg-surface-container text-on-surface text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
          >
            <span className="material-symbols-outlined text-[16px] text-emerald-600">visibility</span>
            <span>Preview Sequence</span>
          </button>

          {config.isEnabled ? (
            <button
              type="button"
              onClick={handlePause}
              className="px-3.5 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold flex items-center gap-1.5 hover:bg-amber-700 transition-colors cursor-pointer shadow-xs"
            >
              <span className="material-symbols-outlined text-[16px]">pause</span>
              <span>Pause Campaign</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowWarningModal(true)}
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-700 transition-colors cursor-pointer shadow-xs"
            >
              <span className="material-symbols-outlined text-[16px]">play_arrow</span>
              <span>Activate Reminder</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleStopCampaign}
            className="px-3 py-2 rounded-xl border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">stop</span>
            <span>Stop Campaign</span>
          </button>
        </div>
      </div>

      {/* Main Toggle Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/20 via-surface-container-low to-surface-container border border-emerald-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[28px]">mark_chat_unread</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-on-surface">Send a WhatsApp reminder every 2 days</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-800 dark:text-emerald-300">
                WhatsApp Cloud API
              </span>
            </div>
            <p className="text-xs text-on-surface-variant mt-1 max-w-xl">
              Automatically dispatches personalized promotional WhatsApp reminder messages to selected customer groups every 2 days until they book an appointment.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
          <span className="text-xs font-bold text-on-surface-variant">
            {config.isEnabled ? 'AUTOMATION ACTIVE' : 'AUTOMATION OFF'}
          </span>
          <button
            type="button"
            onClick={handleToggleMain}
            className={`relative inline-flex h-7 w-13 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              config.isEnabled ? 'bg-emerald-600' : 'bg-outline-variant/50'
            }`}
            role="switch"
            aria-checked={config.isEnabled}
          >
            <span
              className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                config.isEnabled ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Main Grid: Form Settings + Timeline & Safeguards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 Columns: Form Configuration */}
        <div className="lg:col-span-7 space-y-6">
          {/* Section 1: Target Audience & Schedule */}
          <div className="p-5 rounded-2xl bg-surface-container-low border border-outline-variant/30 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
              <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[18px]">group</span>
                <span>Target Audience & Schedule</span>
              </h3>
              <span className="text-[11px] font-medium text-on-surface-variant">Step 1 of 3</span>
            </div>

            {/* Customer group */}
            <div>
              <label htmlFor="customer-group-select" className="block text-xs font-bold text-on-surface mb-1.5">
                Customer group
              </label>
              <select
                id="customer-group-select"
                aria-label="Select target customer group for auto reminders"
                value={config.customerGroup}
                onChange={(e) => setConfig({ ...config, customerGroup: e.target.value })}
                className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-xl px-3.5 py-2.5 text-xs font-medium text-on-surface focus:outline-none focus:border-primary cursor-pointer"
              >
                {CUSTOMER_GROUPS.map((grp) => (
                  <option key={grp} value={grp}>
                    {grp}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-on-surface-variant/80 mt-1">
                Estimated reach: <strong className="text-on-surface">142 opt-in customers</strong> matching this filter.
              </p>
            </div>

            {/* Frequency Options */}
            <div>
              <label className="block text-xs font-bold text-on-surface mb-2">Frequency options</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: '2_days' as ReminderFrequencyOption, label: 'Every 2 days', tag: 'Recommended' },
                  { id: '3_days' as ReminderFrequencyOption, label: 'Every 3 days', tag: '' },
                  { id: 'weekly' as ReminderFrequencyOption, label: 'Weekly', tag: 'Every 7d' },
                  { id: 'custom' as ReminderFrequencyOption, label: 'Custom', tag: 'Set days' },
                ].map((freq) => {
                  const isSelected = config.frequency === freq.id;
                  return (
                    <button
                      key={freq.id}
                      type="button"
                      onClick={() => setConfig({ ...config, frequency: freq.id })}
                      className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200 ring-1 ring-emerald-500'
                          : 'border-outline-variant/40 bg-surface-container-lowest hover:bg-surface-container text-on-surface'
                      }`}
                    >
                      <span className="text-xs font-bold">{freq.label}</span>
                      {freq.tag && (
                        <span
                          className={`text-[9px] font-semibold mt-1 px-1.5 py-0.2 rounded-full w-max ${
                            isSelected
                              ? 'bg-emerald-500 text-white'
                              : 'bg-surface-container text-on-surface-variant'
                          }`}
                        >
                          {freq.tag}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Custom days input if custom frequency selected */}
              {config.frequency === 'custom' && (
                <div className="mt-3 flex items-center gap-3 p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/30">
                  <span className="text-xs font-bold text-on-surface">Repeat every:</span>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={config.customDays}
                    onChange={(e) => setConfig({ ...config, customDays: parseInt(e.target.value) || 1 })}
                    className="w-16 bg-surface-container border border-outline-variant/40 rounded-lg px-2.5 py-1 text-xs font-bold text-on-surface text-center focus:outline-none"
                  />
                  <span className="text-xs text-on-surface-variant">days interval</span>
                </div>
              )}
            </div>

            {/* Start date & End date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="start-date-input" className="block text-xs font-bold text-on-surface mb-1.5">
                  Start date
                </label>
                <input
                  id="start-date-input"
                  type="date"
                  value={config.startDate}
                  onChange={(e) => setConfig({ ...config, startDate: e.target.value })}
                  className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-xl px-3 py-2 text-xs font-medium text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label htmlFor="end-date-input" className="block text-xs font-bold text-on-surface mb-1.5">
                  End date
                </label>
                <input
                  id="end-date-input"
                  type="date"
                  value={config.endDate}
                  onChange={(e) => setConfig({ ...config, endDate: e.target.value })}
                  className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-xl px-3 py-2 text-xs font-medium text-on-surface focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            {/* Send time & Maximum reminders */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="send-time-select" className="block text-xs font-bold text-on-surface mb-1.5">
                  Send time
                </label>
                <select
                  id="send-time-select"
                  aria-label="Select reminder send time"
                  value={config.sendTime}
                  onChange={(e) => setConfig({ ...config, sendTime: e.target.value })}
                  className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-xl px-3 py-2 text-xs font-medium text-on-surface focus:outline-none cursor-pointer"
                >
                  <option value="09:00 AM">09:00 AM (Morning)</option>
                  <option value="10:00 AM">10:00 AM (Recommended)</option>
                  <option value="11:30 AM">11:30 AM (Pre-Lunch)</option>
                  <option value="02:00 PM">02:00 PM (Afternoon)</option>
                  <option value="05:30 PM">05:30 PM (Evening)</option>
                  <option value="07:00 PM">07:00 PM (Night Check)</option>
                </select>
              </div>

              <div>
                <label htmlFor="max-reminders-input" className="block text-xs font-bold text-on-surface mb-1.5">
                  Maximum reminders
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="max-reminders-input"
                    type="number"
                    min={1}
                    max={5}
                    value={config.maximumReminders}
                    onChange={(e) => setConfig({ ...config, maximumReminders: parseInt(e.target.value) || 1 })}
                    className="w-20 bg-surface-container-lowest border border-outline-variant/40 rounded-xl px-3 py-2 text-xs font-bold text-on-surface text-center focus:outline-none focus:border-primary"
                  />
                  <span className="text-[11px] text-on-surface-variant">
                    messages max per customer campaign (Default: 3)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Offer & Message Template */}
          <div className="p-5 rounded-2xl bg-surface-container-low border border-outline-variant/30 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
              <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[18px]">local_offer</span>
                <span>Selected Offer & Message Template</span>
              </h3>
              <span className="text-[11px] font-medium text-on-surface-variant">Step 2 of 3</span>
            </div>

            {/* Selected offer */}
            <div>
              <label htmlFor="selected-offer-select" className="block text-xs font-bold text-on-surface mb-1.5">
                Selected offer
              </label>
              <select
                id="selected-offer-select"
                aria-label="Select promotional offer for WhatsApp reminder"
                value={config.selectedOffer}
                onChange={(e) => setConfig({ ...config, selectedOffer: e.target.value })}
                className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-xl px-3.5 py-2.5 text-xs font-medium text-on-surface focus:outline-none focus:border-primary cursor-pointer"
              >
                {OFFERS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>

            {/* Template Presets */}
            <div>
              <span className="block text-xs font-bold text-on-surface mb-1.5">Preset Templates</span>
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {TEMPLATE_PRESETS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => setConfig({ ...config, messageTemplate: p.template })}
                    className="px-3 py-1.5 rounded-xl border border-outline-variant/40 bg-surface-container-lowest hover:bg-surface-container text-[11px] font-semibold text-on-surface shrink-0 cursor-pointer"
                  >
                    ✨ {p.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Dynamic Token Buttons */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="message-template-textarea" className="text-xs font-bold text-on-surface">
                  Message template
                </label>
                <span className="text-[10px] text-on-surface-variant">Click token to insert:</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap mb-2">
                {[
                  '{{customer_name}}',
                  '{{salon_name}}',
                  '{{offer_name}}',
                  '{{booking_link}}',
                  '{{expiry_date}}',
                ].map((token) => (
                  <button
                    key={token}
                    type="button"
                    onClick={() => insertToken(token)}
                    className="px-2 py-1 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-bold cursor-pointer"
                  >
                    + {token}
                  </button>
                ))}
              </div>

              <textarea
                id="message-template-textarea"
                rows={4}
                value={config.messageTemplate}
                onChange={(e) => setConfig({ ...config, messageTemplate: e.target.value })}
                className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-3 text-xs font-mono text-on-surface focus:outline-none focus:border-primary leading-relaxed"
                placeholder="Write your WhatsApp message template here..."
              />
            </div>
          </div>

          {/* Section 3: Smart Rules & Suppression Controls */}
          <div className="p-5 rounded-2xl bg-surface-container-low border border-outline-variant/30 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
              <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[18px]">tune</span>
                <span>Smart Rules & Suppression Controls</span>
              </h3>
              <span className="text-[11px] font-medium text-on-surface-variant">Step 3 of 3</span>
            </div>

            <div className="space-y-3">
              {/* Stop after booking */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/20">
                <div>
                  <span className="text-xs font-bold text-on-surface block">Stop after booking</span>
                  <span className="text-[11px] text-on-surface-variant">
                    Automatically halts further reminders as soon as the customer makes a salon appointment.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, stopAfterBooking: !config.stopAfterBooking })}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                    config.stopAfterBooking ? 'bg-emerald-600' : 'bg-outline-variant/50'
                  }`}
                  role="switch"
                  aria-checked={config.stopAfterBooking}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ${
                      config.stopAfterBooking ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Stop after offer expiry */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/20">
                <div>
                  <span className="text-xs font-bold text-on-surface block">Stop after offer expiry</span>
                  <span className="text-[11px] text-on-surface-variant">
                    Stops sending campaign messages once the campaign end date or offer voucher expires.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, stopAfterOfferExpiry: !config.stopAfterOfferExpiry })}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                    config.stopAfterOfferExpiry ? 'bg-emerald-600' : 'bg-outline-variant/50'
                  }`}
                  role="switch"
                  aria-checked={config.stopAfterOfferExpiry}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ${
                      config.stopAfterOfferExpiry ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Skip customers contacted recently */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/20">
                <div>
                  <span className="text-xs font-bold text-on-surface block">Skip customers contacted recently</span>
                  <span className="text-[11px] text-on-surface-variant">
                    Do not message customers who received marketing broadcasts in the last {config.skipRecentlyContactedDays} days.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, skipRecentlyContacted: !config.skipRecentlyContacted })}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                    config.skipRecentlyContacted ? 'bg-emerald-600' : 'bg-outline-variant/50'
                  }`}
                  role="switch"
                  aria-checked={config.skipRecentlyContacted}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ${
                      config.skipRecentlyContacted ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Exclude unsubscribed customers */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/20 opacity-90">
                <div className="pr-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-on-surface">Exclude unsubscribed customers</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-800 dark:text-emerald-300">
                      Enforced Compliance
                    </span>
                  </div>
                  <span className="text-[11px] text-on-surface-variant">
                    Strictly suppresses messaging any phone numbers registered on opt-out lists or DND registries.
                  </span>
                </div>
                <div className="flex items-center gap-1 text-emerald-600">
                  <span className="material-symbols-outlined text-[20px]">verified_user</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right 5 Columns: Mock Timeline & Default Safeguards */}
        <div className="lg:col-span-5 space-y-6">
          {/* Prominent Warning Text Box */}
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 space-y-2">
            <div className="flex items-center gap-2 font-bold text-xs text-amber-800 dark:text-amber-300">
              <span className="material-symbols-outlined text-[20px] text-amber-600">warning</span>
              <span>Important Marketing Policy</span>
            </div>
            <p className="text-xs leading-relaxed font-medium">
              Frequent promotional messages may annoy customers. Send only to customers who have agreed to receive marketing messages.
            </p>
          </div>

          {/* Mock Timeline Display */}
          <div className="p-5 rounded-2xl bg-surface-container-low border border-outline-variant/30 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
              <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600 text-[18px]">timeline</span>
                <span>Mock Campaign Timeline</span>
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-surface-container text-on-surface-variant">
                {config.frequency === '2_days'
                  ? '2-Day Interval'
                  : config.frequency === '3_days'
                  ? '3-Day Interval'
                  : config.frequency === 'weekly'
                  ? '7-Day Interval'
                  : `${config.customDays}-Day Interval`}
              </span>
            </div>

            <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-outline-variant/40">
              {getTimelineSteps().map((step, idx) => (
                <div key={idx} className="relative flex items-start gap-3 group">
                  <div
                    className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full border-2 bg-surface-container-lowest flex items-center justify-center text-[10px] font-bold ${step.color}`}
                  >
                    {idx + 1}
                  </div>
                  <div className="p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/20 w-full hover:border-outline-variant/40 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-on-surface">{step.title}</span>
                      <span className={`text-[9px] font-bold px-2 py-0.2 rounded-full border ${step.color}`}>
                        {step.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-on-surface-variant mt-1 leading-normal">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Default Safeguards Panel */}
          <div className="p-5 rounded-2xl bg-surface-container-low border border-outline-variant/30 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
              <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600 text-[18px]">shield</span>
                <span>Enforced Default Safeguards</span>
              </h3>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded">
                Active Policy
              </span>
            </div>

            <ul className="space-y-2.5 text-xs text-on-surface-variant">
              {[
                'Maximum 3 reminders per campaign',
                'Do not message without customer consent',
                'Do not message unsubscribed customers',
                'Stop reminders when customer books',
                'Do not send outside selected business hours',
                'Show warning before activation',
              ].map((sg, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-emerald-500 text-[16px] shrink-0 mt-0.5">
                    check_circle
                  </span>
                  <span className="font-medium text-on-surface">{sg}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Live Campaign Performance Preview Stats */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-900/10 to-surface-container-low border border-emerald-500/20 space-y-3">
            <span className="text-xs font-bold text-on-surface flex items-center gap-1.5">
              <span className="material-symbols-outlined text-emerald-600 text-[16px]">analytics</span>
              <span>Projected Campaign Impact</span>
            </span>

            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="p-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/20">
                <span className="text-base font-bold text-on-surface block">
                  {config.campaignStats?.audienceCount || 142}
                </span>
                <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">
                  Target Reach
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/20">
                <span className="text-base font-bold text-emerald-600 block">
                  {config.campaignStats?.conversionRate || 15.8}%
                </span>
                <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">
                  Est. Booking Rate
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Activation Warning Modal */}
      {showWarningModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[28px]">warning</span>
            </div>

            <div>
              <h3 className="text-lg font-bold text-on-surface">Confirm Campaign Activation</h3>
              <p className="text-xs text-on-surface-variant mt-1.5 leading-relaxed">
                Frequent promotional messages may annoy customers. Send only to customers who have agreed to receive marketing messages.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/30 text-xs space-y-1.5 text-on-surface-variant">
              <div className="flex justify-between">
                <span>Frequency:</span>
                <strong className="text-on-surface">{config.frequency.replace('_', ' ')}</strong>
              </div>
              <div className="flex justify-between">
                <span>Customer Group:</span>
                <strong className="text-on-surface">{config.customerGroup}</strong>
              </div>
              <div className="flex justify-between">
                <span>Max Reminders:</span>
                <strong className="text-on-surface">{config.maximumReminders} per customer</strong>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowWarningModal(false)}
                className="px-4 py-2.5 rounded-xl border border-outline-variant/40 text-on-surface text-xs font-semibold hover:bg-surface-container transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmActivation}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                <span>I Understand & Activate</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Sequence Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-500/15 text-emerald-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">chat</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-on-surface">WhatsApp Sequence Preview</h3>
                  <span className="text-[11px] text-on-surface-variant">
                    Customer Experience View for "{config.customerGroup}"
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* WhatsApp Chat Simulator Canvas */}
            <div className="flex-1 overflow-y-auto p-4 rounded-2xl bg-[#efeae2] dark:bg-[#0b141a] space-y-4 border border-outline-variant/30 font-sans">
              <div className="text-center">
                <span className="text-[10px] font-semibold px-3 py-1 rounded-full bg-white/80 dark:bg-gray-800/80 text-gray-600 dark:text-gray-300 shadow-2xs">
                  Today • Auto Sequence Starts
                </span>
              </div>

              {/* Message Bubble 1 */}
              <div className="flex flex-col items-start max-w-[85%]">
                <div className="p-3.5 rounded-2xl rounded-tl-xs bg-white dark:bg-[#202c33] text-gray-900 dark:text-gray-100 shadow-sm space-y-2 border border-black/5">
                  <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    <span>Nexora Salon & Spa</span>
                    <span className="material-symbols-outlined text-[14px]">verified</span>
                  </div>
                  <p className="text-xs leading-relaxed whitespace-pre-line">
                    {renderFormattedPreview(config.messageTemplate)}
                  </p>
                  <div className="flex items-center justify-end gap-1 text-[9px] text-gray-400">
                    <span>{config.sendTime}</span>
                    <span className="material-symbols-outlined text-[12px] text-sky-500">done_all</span>
                  </div>
                </div>
                <span className="text-[9px] text-gray-500 mt-1 pl-1">Day 1 — Initial Outreach</span>
              </div>

              {/* Message Bubble 2 (Reminder 1) */}
              <div className="flex flex-col items-start max-w-[85%]">
                <div className="p-3.5 rounded-2xl rounded-tl-xs bg-white dark:bg-[#202c33] text-gray-900 dark:text-gray-100 shadow-sm space-y-2 border border-black/5 opacity-90">
                  <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    <span>Nexora Salon & Spa</span>
                    <span className="material-symbols-outlined text-[14px]">verified</span>
                  </div>
                  <p className="text-xs leading-relaxed">
                    Quick reminder! Your {config.selectedOffer} voucher is waiting. Slots for this weekend are filling up fast! ✂️✨
                  </p>
                  <div className="flex items-center justify-end gap-1 text-[9px] text-gray-400">
                    <span>{config.sendTime}</span>
                    <span className="material-symbols-outlined text-[12px] text-sky-500">done_all</span>
                  </div>
                </div>
                <span className="text-[9px] text-gray-500 mt-1 pl-1">
                  {config.frequency === '2_days'
                    ? 'Day 3 — Follow-up Reminder'
                    : config.frequency === '3_days'
                    ? 'Day 4 — Follow-up Reminder'
                    : 'Day 8 — Follow-up Reminder'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="px-5 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-bold transition-colors cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
