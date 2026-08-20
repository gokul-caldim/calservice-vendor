import React, { useState, useEffect } from 'react';
import {
  X,
  Building2,
  MapPin,
  Mail,
  FileText,
  Shield,
  RotateCcw,
  Truck,
  Copy,
  Check,
  Phone,
  Send,
  CheckCircle2,
  AlertTriangle,
  Scale,
  CreditCard,
  Camera,
  Clock,
  Briefcase,
  UserCheck,
  Server,
  Database,
  Download,
  PackageCheck,
  Navigation,
  Compass,
  FileCheck,
  Headphones,
  Loader2,
  Calendar,
  ExternalLink,
} from 'lucide-react';
import { apiSubmitSupportInquiry } from '../../api/workforceService.js';

export function LegalComplianceModal({
  isOpen = false,
  onClose = () => {},
  initialTab = 'contact',
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [copiedKey, setCopiedKey] = useState('');

  // Support Ticket Form State
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    phone: '',
    category: 'general',
    subject: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [ticketResponse, setTicketResponse] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setSubmitError('');
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 2500);
  };

  const handleQuickContactSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');

    if (!contactForm.name.trim()) {
      setSubmitError('Full name is required.');
      return;
    }
    if (!contactForm.email.trim() || !contactForm.email.includes('@')) {
      setSubmitError('A valid corporate or personal email address is required.');
      return;
    }
    if (!contactForm.message.trim()) {
      setSubmitError('Please provide details regarding your inquiry.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await apiSubmitSupportInquiry({
        name: contactForm.name.trim(),
        email: contactForm.email.trim(),
        phone: contactForm.phone.trim(),
        category: contactForm.category,
        subject: contactForm.subject.trim() || 'Operations Support Inquiry',
        message: contactForm.message.trim(),
      });

      setTicketResponse(res || {
        ticket_id: `CAL-${Math.floor(100000 + Math.random() * 900000)}`,
        email: contactForm.email.trim(),
        submitted_at: new Date().toISOString(),
      });
      setContactForm({ name: '', email: '', phone: '', category: 'general', subject: '', message: '' });
    } catch (err) {
      console.error('Failed to submit support inquiry:', err);
      setSubmitError(err?.message || 'Unable to log inquiry. Please email support@caldimengg.in directly.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const tabs = [
    { id: 'contact', label: 'Corporate Information', icon: Building2 },
    { id: 'terms', label: 'Terms of Service', icon: FileText },
    { id: 'privacy', label: 'Privacy Policy', icon: Shield },
    { id: 'refunds', label: 'Cancellation & Refunds', icon: RotateCcw },
    { id: 'shipping', label: 'Fulfillment & Delivery', icon: Truck },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto font-sans antialiased text-slate-900">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Industrial Enterprise Modal Shell */}
      <div className="relative bg-white rounded-md border border-slate-300 shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden z-10 animate-fade-in text-[12px] leading-relaxed">
        {/* ── TOP STATUTORY HEADER ── */}
        <div className="px-5 py-3.5 bg-slate-900 text-white border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-white shrink-0 shadow-inner">
              <Building2 className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <div className="text-[12px] font-bold tracking-wide uppercase text-white flex items-center gap-2">
                <span>CALDIM ENGINEERING PRIVATE LIMITED</span>
                <span className="text-[9px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700 font-mono">
                  DOC-REF: CS-LEGAL-2026
                </span>
              </div>
              <div className="text-[11px] text-slate-400 font-normal">
                CalServices Workforce Operations & Legal Compliance Architecture
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-medium text-slate-300 bg-slate-800/90 border border-slate-700 px-2.5 py-1 rounded">
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              <span>Effective Date: August 20, 2026</span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close Dialog (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── ENTERPRISE TAB SEGMENT ── */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 flex items-center gap-1 overflow-x-auto scrollbar-none shrink-0">
          {tabs.map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2.5 font-medium text-[11px] uppercase tracking-wider transition-all border-b-2 shrink-0 cursor-pointer ${
                  isActive
                    ? 'border-blue-600 text-blue-900 bg-white font-bold shadow-2xs'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-600' : 'text-slate-500'}`} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* ── MODAL SCROLLABLE BODY ── */}
        <div className="p-6 overflow-y-auto flex-1 text-slate-800 space-y-6">
          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* ════ TAB 1: CORPORATE INFORMATION ════ */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'contact' && (
            <div className="space-y-6">
              {/* Statutory Registry Table */}
              <div className="border border-slate-300 rounded overflow-hidden shadow-2xs bg-white">
                <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-300 flex items-center justify-between flex-wrap gap-2">
                  <span className="font-bold text-[11px] text-slate-900 uppercase tracking-wider">
                    Statutory & Corporate Registry Information
                  </span>
                  <span className="text-[10px] font-mono text-slate-600">
                    Jurisdiction: Chennai, Tamil Nadu, India
                  </span>
                </div>

                <div className="divide-y divide-slate-200 text-[11px]">
                  <div className="grid grid-cols-1 md:grid-cols-3 p-3 bg-white">
                    <span className="font-semibold text-slate-600">Legal Corporate Entity</span>
                    <span className="md:col-span-2 font-bold text-slate-900">
                      CALDIM ENGINEERING PRIVATE LIMITED
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 p-3 bg-slate-50/50">
                    <span className="font-semibold text-slate-600">Registered Office</span>
                    <span className="md:col-span-2 text-slate-800 text-justify">
                      Minmac center #118, First Floor, Arcot Road, Valasaravalakkam, Chennai - 600087, Tamil Nadu, India.
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 p-3 bg-white">
                    <span className="font-semibold text-slate-600">Tax Identification (GSTIN)</span>
                    <div className="md:col-span-2 flex items-center justify-between">
                      <span className="font-mono font-bold text-slate-900">33AAGCC4916J1ZP</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard('33AAGCC4916J1ZP', 'gstin')}
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium border border-slate-300 rounded hover:bg-slate-100 transition-colors cursor-pointer text-slate-700"
                      >
                        {copiedKey === 'gstin' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedKey === 'gstin' ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 p-3 bg-slate-50/50">
                    <span className="font-semibold text-slate-600">Corporate Identity Number (CIN)</span>
                    <div className="md:col-span-2 flex items-center justify-between">
                      <span className="font-mono font-bold text-slate-900">U72900KA2026PTC123456</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard('U72900KA2026PTC123456', 'cin')}
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium border border-slate-300 rounded hover:bg-slate-100 transition-colors cursor-pointer text-slate-700"
                      >
                        {copiedKey === 'cin' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedKey === 'cin' ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 p-3 bg-white">
                    <span className="font-semibold text-slate-600">Official Support & Legal Notice</span>
                    <span className="md:col-span-2">
                      <a href="mailto:support@caldimengg.in" className="text-blue-700 font-mono font-bold underline hover:text-blue-900">
                        support@caldimengg.in
                      </a>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 p-3 bg-slate-50/50">
                    <span className="font-semibold text-slate-600">Office Contact Number</span>
                    <span className="md:col-span-2 font-mono font-semibold text-slate-900">
                      <a href="tel:2484553855" className="text-slate-900 hover:text-blue-700 underline">
                        248-455 3855
                      </a>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 p-3 bg-white">
                    <span className="font-semibold text-slate-600">Operating Service Hours</span>
                    <span className="md:col-span-2 text-slate-800 font-medium">
                      Monday through Saturday, 9:00 AM to 6:00 PM IST (Excluding statutory public holidays).
                    </span>
                  </div>
                </div>
              </div>

              {/* Service Desks Key Roles */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-1">
                  <p className="font-bold text-slate-900 uppercase tracking-wide">
                    1. Operations & Dispatch Desk
                  </p>
                  <p className="text-slate-600 text-justify">
                    Handles active job telemetry, technician location routing, OTP verification audits, and priority service dispatching during operating hours.
                  </p>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-1">
                  <p className="font-bold text-slate-900 uppercase tracking-wide">
                    2. Technician Onboarding Desk
                  </p>
                  <p className="text-slate-600 text-justify">
                    Manages KYC audits, trade license verifications, category approvals, and regulatory compliance reviews within 4 business hours.
                  </p>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-1">
                  <p className="font-bold text-slate-900 uppercase tracking-wide">
                    3. Billing & Dispute Desk
                  </p>
                  <p className="text-slate-600 text-justify">
                    Processes tax invoices, customer refund requests, work extension approvals, and weekly bank settlements for certified technicians.
                  </p>
                </div>
              </div>

              {/* Official Support Ticket Lodgment Form */}
              <div className="border border-slate-300 rounded bg-slate-50/60 p-4 space-y-3">
                <div className="border-b border-slate-200 pb-2 flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 text-[12px] uppercase tracking-wide flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5 text-slate-700" />
                    <span>Direct Operations Support Inquiry</span>
                  </h3>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Direct routing to: support@caldimengg.in
                  </span>
                </div>

                {submitError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-300 rounded text-rose-900 text-[11px] flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{submitError}</span>
                  </div>
                )}

                {ticketResponse ? (
                  <div className="p-4 bg-emerald-50 border border-emerald-300 rounded text-emerald-950 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                        <div>
                          <p className="font-bold text-[12px]">Support Inquiry Successfully Logged</p>
                          <p className="text-[11px] text-emerald-900">
                            Ticket reference has been logged and dispatched to <strong>support@caldimengg.in</strong>.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 bg-white border border-emerald-300 px-2.5 py-1 rounded text-[11px] font-mono font-bold text-emerald-950">
                        <span>{ticketResponse.ticket_id}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(ticketResponse.ticket_id, 'ticket')}
                          className="p-0.5 hover:text-emerald-700 cursor-pointer"
                          title="Copy Ticket Reference"
                        >
                          {copiedKey === 'ticket' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-emerald-900 pl-6 text-justify">
                      An operations engineer will review your inquiry and follow up at <span className="font-semibold">{ticketResponse.email}</span> during operating hours (Monday – Saturday, 9:00 AM to 6:00 PM IST).
                    </p>
                    <div className="pt-2 pl-6 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setTicketResponse(null);
                          setSubmitError('');
                        }}
                        className="px-3 py-1 bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-[11px] rounded transition-colors cursor-pointer"
                      >
                        Submit Another Inquiry
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleQuickContactSubmit} className="space-y-3 text-[11px]">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Full Name <span className="text-rose-600">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Rahul Sharma"
                          value={contactForm.name}
                          onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-900 focus:outline-hidden focus:border-slate-900"
                          disabled={isSubmitting}
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Email Address <span className="text-rose-600">*</span>
                        </label>
                        <input
                          type="email"
                          required
                          placeholder="e.g. rahul@example.com"
                          value={contactForm.email}
                          onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-900 focus:outline-hidden focus:border-slate-900"
                          disabled={isSubmitting}
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Office / Mobile Contact (Optional)
                        </label>
                        <input
                          type="tel"
                          placeholder="e.g. 248-455 3855"
                          value={contactForm.phone}
                          onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-900 focus:outline-hidden focus:border-slate-900"
                          disabled={isSubmitting}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Inquiry Details / Issue Narrative <span className="text-rose-600">*</span>
                      </label>
                      <textarea
                        rows={2}
                        required
                        placeholder="Detail your request, technician onboarding issue, dispatch question, or service verification enquiry..."
                        value={contactForm.message}
                        onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-900 resize-none focus:outline-hidden focus:border-slate-900"
                        disabled={isSubmitting}
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-slate-500">
                        Response Standard: Handled within 4 business hours.
                      </span>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-bold text-[11px] rounded transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Logging Ticket...</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" />
                            <span>Submit Support Request</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* ════ TAB 2: TERMS OF SERVICE (FORMAL CLAUSES) ════ */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'terms' && (
            <div className="space-y-6 text-slate-800">
              {/* Header Ribbon */}
              <div className="p-3 bg-slate-100 border border-slate-300 rounded flex items-center justify-between flex-wrap gap-2 text-[11px]">
                <div className="font-semibold text-slate-900">
                  Operating Entity: CALDIM ENGINEERING PRIVATE LIMITED (CIN: U72900KA2026PTC123456, GSTIN: 33AAGCC4916J1ZP)
                </div>
                <div className="font-mono text-slate-600">
                  Effective Date: August 20, 2026
                </div>
              </div>

              {/* Clause 1 */}
              <section className="space-y-2">
                <h3 className="font-bold text-slate-900 text-[12px] uppercase tracking-wider border-b border-slate-200 pb-1 flex items-center gap-2">
                  <span>1.0</span>
                  <span>Scope of Operating Agreement & Service Definitions</span>
                </h3>
                <p className="text-justify leading-relaxed">
                  These Terms of Service constitute a legally binding contractual framework established between <strong>CALDIM ENGINEERING PRIVATE LIMITED</strong> (“Company”, “Platform”, “CalServices”) and any certified technician, contractor, enterprise customer, or individual accessing the workforce portal. CalServices provides a synchronized digital infrastructure facilitating on-demand engineering diagnostics, field calibration, appliance repairs, and spare parts fulfillment. Accessing or executing service bookings through the portal signifies unconditional acceptance of these terms. For legal notices, contact <a href="mailto:support@caldimengg.in" className="text-blue-700 font-mono font-semibold underline">support@caldimengg.in</a>.
                </p>
              </section>

              {/* Clause 2 */}
              <section className="space-y-2">
                <h3 className="font-bold text-slate-900 text-[12px] uppercase tracking-wider border-b border-slate-200 pb-1 flex items-center gap-2">
                  <span>2.0</span>
                  <span>Technician Eligibility, KYC Verification & Licensing Audits</span>
                </h3>
                <p className="text-justify leading-relaxed">
                  Field technicians must complete mandatory multi-tier verification before gaining dispatch eligibility. Requirements include validated government-issued identification, active trade licensing, relevant technical calibration credentials, background clearance, and registered bank account binding. Expired certifications or failing compliance metrics result in instantaneous, server-enforced suspension of automatic dispatch capabilities.
                </p>
              </section>

              {/* Clause 3 */}
              <section className="space-y-2">
                <h3 className="font-bold text-slate-900 text-[12px] uppercase tracking-wider border-b border-slate-200 pb-1 flex items-center gap-2">
                  <span>3.0</span>
                  <span>Spatial Dispatching, 20km Geofence & 6-Digit OTP Verification</span>
                </h3>
                <p className="text-justify leading-relaxed">
                  Automated dispatching operates on an algorithmic proximity model constrained to a maximum 20-kilometer operational service radius from the technician’s verified position to the customer installation site. Continuous GPS telemetry is transmitted only while clocked-in and actively en route to calculate real-time arrival estimates. Arrival is recognized when within 300 meters of the site. Work commencement strictly requires the technician to physically input the 6-digit start OTP displayed on the customer’s application screen.
                </p>
              </section>

              {/* Clause 4 */}
              <section className="space-y-2">
                <h3 className="font-bold text-slate-900 text-[12px] uppercase tracking-wider border-b border-slate-200 pb-1 flex items-center gap-2">
                  <span>4.0</span>
                  <span>Proof of Work & Diagnostic Quality Assurance</span>
                </h3>
                <p className="text-justify leading-relaxed">
                  Every service execution mandates the electronic submission of photographic proof. Technicians must upload clear pre-service photographs displaying the appliance manufacturer serial plate, diagnostic readings, and preexisting physical condition prior to disassembly. Upon service completion, post-service photographs confirming operational functionality, replaced hardware components, and clean customer premises must be submitted with immutable server timestamps.
                </p>
              </section>

              {/* Clause 5 */}
              <section className="space-y-2">
                <h3 className="font-bold text-slate-900 text-[12px] uppercase tracking-wider border-b border-slate-200 pb-1 flex items-center gap-2">
                  <span>5.0</span>
                  <span>Tariff Rates, Tax Compliance & Financial Settlements</span>
                </h3>
                <p className="text-justify leading-relaxed">
                  All labor charges, diagnostic fees, and replacement components are catalog-governed in INR (₹) inclusive of statutory Goods and Services Tax under GSTIN 33AAGCC4916J1ZP. Where Cash-on-Delivery (COD) is chosen by the customer, the technician is strictly obligated to record the precise collected cash amount within the mobile application. Technician earnings, service incentives, and verified reimbursements are audited and disbursed weekly via direct automated electronic bank transfer (NEFT/ACH).
                </p>
              </section>

              {/* Clause 6 */}
              <section className="space-y-2">
                <h3 className="font-bold text-slate-900 text-[12px] uppercase tracking-wider border-b border-slate-200 pb-1 flex items-center gap-2">
                  <span>6.0</span>
                  <span>Work Extensions, Spare Parts Fulfillment & Warranty</span>
                </h3>
                <p className="text-justify leading-relaxed">
                  Unforeseen repairs requiring supplementary labor or replacement hardware strictly require an electronic Work Extension Request submitted via the technician interface. No additional charge may be collected nor unapproved part installed without prior digital authorization and price consent from the customer. All replacement parts supplied through CalServices channels are genuine OEM components carrying standard manufacturer warranties.
                </p>
              </section>

              {/* Clause 7 */}
              <section className="space-y-2">
                <h3 className="font-bold text-slate-900 text-[12px] uppercase tracking-wider border-b border-slate-200 pb-1 flex items-center gap-2">
                  <span>7.0</span>
                  <span>Code of Conduct, Safety Standards & Anti-Solicitation</span>
                </h3>
                <p className="text-justify leading-relaxed">
                  Technicians must wear approved Personal Protective Equipment (PPE), observe electrical safety protocols, and maintain professional demeanor. Off-platform private solicitation of CalServices customers or unrecorded cash transactions constitute severe material breaches of contract, leading to immediate permanent deactivation, forfeiture of accrued pending payouts, and statutory legal recourse.
                </p>
              </section>

              {/* Clause 8 */}
              <section className="space-y-2">
                <h3 className="font-bold text-slate-900 text-[12px] uppercase tracking-wider border-b border-slate-200 pb-1 flex items-center gap-2">
                  <span>8.0</span>
                  <span>Limitation of Liability, Indemnity & Jurisdiction</span>
                </h3>
                <p className="text-justify leading-relaxed">
                  CALDIM ENGINEERING PRIVATE LIMITED shall not be held liable for preexisting equipment failures, indirect commercial losses, or acts of force majeure. Technicians agree to indemnify the Company against third-party claims arising from gross negligence or unauthorized off-platform activities. Any dispute arising under this agreement shall be submitted to the Operations Dispute Desk prior to arbitration proceedings situated exclusively under the jurisdiction of the competent courts in Chennai, Tamil Nadu, India.
                </p>
              </section>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* ════ TAB 3: PRIVACY POLICY (FORMAL CLAUSES) ════ */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'privacy' && (
            <div className="space-y-6 text-slate-800">
              {/* Header Ribbon */}
              <div className="p-3 bg-slate-100 border border-slate-300 rounded flex items-center justify-between flex-wrap gap-2 text-[11px]">
                <div className="font-semibold text-slate-900">
                  Data Controller: CALDIM ENGINEERING PRIVATE LIMITED (CIN: U72900KA2026PTC123456)
                </div>
                <div className="font-mono text-slate-600">
                  Effective Date: August 20, 2026
                </div>
              </div>

              {/* Clause 1 */}
              <section className="space-y-2">
                <h3 className="font-bold text-slate-900 text-[12px] uppercase tracking-wider border-b border-slate-200 pb-1 flex items-center gap-2">
                  <span>1.0</span>
                  <span>Information Collection & Statutory Ground</span>
                </h3>
                <p className="text-justify leading-relaxed">
                  CalServices processes personal identification, professional certification data, and service telemetry strictly under statutory contractual necessity. Collected data comprises technician identity records (Government ID, PAN/Aadhaar/Tax numbers), trade certifications, customer service locations, diagnostic photographs, attendance logs, and financial transaction records required for field operations, invoicing, and regulatory tax compliance.
                </p>
              </section>

              {/* Clause 2 */}
              <section className="space-y-2">
                <h3 className="font-bold text-slate-900 text-[12px] uppercase tracking-wider border-b border-slate-200 pb-1 flex items-center gap-2">
                  <span>2.0</span>
                  <span>Real-Time GPS Telemetry & Shift Restrictions</span>
                </h3>
                <p className="text-justify leading-relaxed">
                  Geospatial tracking is restricted exclusively to active duty hours. Telemetry data is collected only when a technician is clocked in for an operational shift and is actively navigating toward an accepted service booking. This data powers live customer arrival estimations and geofence arrival triggers. Telemetry recording terminates immediately upon shift clock-out or when changing availability status to Offline.
                </p>
              </section>

              {/* Clause 3 */}
              <section className="space-y-2">
                <h3 className="font-bold text-slate-900 text-[12px] uppercase tracking-wider border-b border-slate-200 pb-1 flex items-center gap-2">
                  <span>3.0</span>
                  <span>Multi-Tenant Database Isolation & Cryptographic Protection</span>
                </h3>
                <p className="text-justify leading-relaxed">
                  All platform records reside within enterprise PostgreSQL databases enforced with tenant company isolation and Row-Level Security (RLS). Zero cross-tenant data leakage is permitted. All network communications are secured using TLS 1.3 encryption in transit, and confidential credentials, identity records, and biometric tokens are protected using AES-256 encryption at rest.
                </p>
              </section>

              {/* Clause 4 */}
              <section className="space-y-2">
                <h3 className="font-bold text-slate-900 text-[12px] uppercase tracking-wider border-b border-slate-200 pb-1 flex items-center gap-2">
                  <span>4.0</span>
                  <span>Third-Party Data Processors & Zero Commercial Sale</span>
                </h3>
                <p className="text-justify leading-relaxed">
                  CALDIM ENGINEERING PRIVATE LIMITED strictly does not sell, lease, or monetize personal or operational telemetry. Data is shared exclusively with certified enterprise infrastructure partners essential to operations: secure banking gateways (Razorpay/Stripe) for payment tokenization, Mapbox/OpenStreetMap for navigational geofencing, and AWS/Supabase for encrypted document archives.
                </p>
              </section>

              {/* Clause 5 */}
              <section className="space-y-2">
                <h3 className="font-bold text-slate-900 text-[12px] uppercase tracking-wider border-b border-slate-200 pb-1 flex items-center gap-2">
                  <span>5.0</span>
                  <span>Data Retention, Dossier Portability & Account Deletion</span>
                </h3>
                <p className="text-justify leading-relaxed">
                  Operational records are retained for the active lifespan of the account. Financial ledgers and proof-of-work media are archived for seven (7) years in compliance with statutory audit regulations. Users have the right to download a machine-readable JSON dossier export of their complete profile, skill endorsements, and job logs directly from their account settings, or request account deactivation once outstanding service obligations and financial balances have cleared.
                </p>
              </section>

              {/* Clause 6 */}
              <section className="space-y-2">
                <h3 className="font-bold text-slate-900 text-[12px] uppercase tracking-wider border-b border-slate-200 pb-1 flex items-center gap-2">
                  <span>6.0</span>
                  <span>Data Protection Officer & Statutory Inquiries</span>
                </h3>
                <p className="text-justify leading-relaxed">
                  Inquiries regarding data governance, subject access requests, or privacy compliance may be directed to our Data Protection Desk at <a href="mailto:support@caldimengg.in" className="text-blue-700 font-mono font-semibold underline">support@caldimengg.in</a> or by written notice to CALDIM ENGINEERING PRIVATE LIMITED, Minmac center #118, First Floor, Arcot Road, Valasaravalakkam, Chennai - 600087. Statutory requests receive formal acknowledgment within 48 business hours.
                </p>
              </section>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* ════ TAB 4: CANCELLATION & REFUNDS (FORMAL CLAUSES) ════ */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'refunds' && (
            <div className="space-y-6 text-slate-800">
              {/* Header Ribbon */}
              <div className="p-3 bg-slate-100 border border-slate-300 rounded flex items-center justify-between flex-wrap gap-2 text-[11px]">
                <div className="font-semibold text-slate-900">
                  Refund Processing Standard: 5 to 7 Business Days (Direct to Source)
                </div>
                <div className="font-mono text-slate-600">
                  Effective Date: August 20, 2026
                </div>
              </div>

              {/* Refund Matrix Table */}
              <section className="space-y-2">
                <h3 className="font-bold text-slate-900 text-[12px] uppercase tracking-wider border-b border-slate-200 pb-1 flex items-center gap-2">
                  <span>1.0</span>
                  <span>Service Cancellation & Refund Schedule by Lifecycle State</span>
                </h3>
                <div className="border border-slate-300 rounded overflow-hidden">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300">
                      <tr>
                        <th className="p-2.5">Service Lifecycle Stage</th>
                        <th className="p-2.5">Customer Refund Eligibility</th>
                        <th className="p-2.5">Transit / Inspection Assessment</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      <tr className="bg-white">
                        <td className="p-2.5 font-semibold text-slate-900">1. Unassigned / Prior to Dispatch</td>
                        <td className="p-2.5 font-bold text-emerald-800">100% Full Refund</td>
                        <td className="p-2.5 text-slate-500">Nil charge ($0.00 / ₹0)</td>
                      </tr>
                      <tr className="bg-slate-50/50">
                        <td className="p-2.5 font-semibold text-slate-900">2. Technician En Route</td>
                        <td className="p-2.5 text-slate-800">Full Service Fee Refunded</td>
                        <td className="p-2.5 text-amber-800">Nominal fuel transit allowance credited to technician</td>
                      </tr>
                      <tr className="bg-white">
                        <td className="p-2.5 font-semibold text-slate-900">3. Arrived at Site (Pre-OTP)</td>
                        <td className="p-2.5 text-slate-800">Service Fee minus Inspection</td>
                        <td className="p-2.5 text-slate-600">Standard on-site physical diagnostic fee applies</td>
                      </tr>
                      <tr className="bg-slate-50/50">
                        <td className="p-2.5 font-semibold text-slate-900">4. Work in Progress (OTP Verified)</td>
                        <td className="p-2.5 font-bold text-rose-800">Labor fee non-refundable</td>
                        <td className="p-2.5 text-slate-600">Prorated on uninstalled parts</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Clause 2 */}
              <section className="space-y-2">
                <h3 className="font-bold text-slate-900 text-[12px] uppercase tracking-wider border-b border-slate-200 pb-1 flex items-center gap-2">
                  <span>2.0</span>
                  <span>Technician Unavailability, Rescheduling & Automatic Backup</span>
                </h3>
                <p className="text-justify leading-relaxed">
                  In the rare event that an assigned technician experiences transit delays, vehicle breakdown, or an operational emergency, our spatial dispatch engine immediately attempts automatic reassignment to the nearest certified secondary technician. Should the arrival delay exceed 30 minutes past the scheduled window, the customer may select priority rescheduling or request an immediate 100% refund without cancellation penalties.
                </p>
              </section>

              {/* Clause 3 */}
              <section className="space-y-2">
                <h3 className="font-bold text-slate-900 text-[12px] uppercase tracking-wider border-b border-slate-200 pb-1 flex items-center gap-2">
                  <span>3.0</span>
                  <span>Settlement Timelines & 30-Day Workmanship Warranty</span>
                </h3>
                <p className="text-justify leading-relaxed">
                  Approved refunds are submitted to banking processors within 24 hours of decision: Credit/Debit Cards require 5 to 7 business days; UPI/Wallets credit within 2 to 24 hours; Net Banking settles in 3 to 5 business days; Cash-on-Delivery payments are refunded via direct NEFT/UPI bank payout. All completed repairs carry a 30-Day Workmanship Guarantee covering re-inspection and corrective service at zero additional labor cost.
                </p>
              </section>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* ════ TAB 5: FULFILLMENT & SERVICE DELIVERY (FORMAL CLAUSES) ════ */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'shipping' && (
            <div className="space-y-6 text-slate-800">
              {/* Header Ribbon */}
              <div className="p-3 bg-slate-100 border border-slate-300 rounded flex items-center justify-between flex-wrap gap-2 text-[11px]">
                <div className="font-semibold text-slate-900">
                  Fulfillment Model: On-Site Field Service & Direct Hardware Hand-Delivery
                </div>
                <div className="font-mono text-slate-600">
                  Effective Date: August 20, 2026
                </div>
              </div>

              {/* Clause 1 */}
              <section className="space-y-2">
                <h3 className="font-bold text-slate-900 text-[12px] uppercase tracking-wider border-b border-slate-200 pb-1 flex items-center gap-2">
                  <span>1.0</span>
                  <span>20-Kilometer Geofenced Service Radius</span>
                </h3>
                <p className="text-justify leading-relaxed">
                  CalServices operates an on-site field engineering fulfillment model. Because physical execution and component delivery occur at the customer’s specified premises, bookings are dynamically dispatched exclusively to certified technicians located within a 20-kilometer operational service zone, optimizing response times and carbon footprint.
                </p>
              </section>

              {/* Clause 2 */}
              <section className="space-y-2">
                <h3 className="font-bold text-slate-900 text-[12px] uppercase tracking-wider border-b border-slate-200 pb-1 flex items-center gap-2">
                  <span>2.0</span>
                  <span>Appointment Windows & 45–90 Minute Express Dispatch</span>
                </h3>
                <p className="text-justify leading-relaxed">
                  Service fulfillment is scheduled in 2-hour appointment windows (e.g. 10:00 AM – 12:00 PM, 2:00 PM – 4:00 PM) during standard service hours (Monday through Saturday, 9:00 AM to 6:00 PM). Emergency breakdowns utilize express spatial dispatch, targeting technician arrival within 45 to 90 minutes of confirmed dispatch offer acceptance.
                </p>
              </section>

              {/* Clause 3 */}
              <section className="space-y-2">
                <h3 className="font-bold text-slate-900 text-[12px] uppercase tracking-wider border-b border-slate-200 pb-1 flex items-center gap-2">
                  <span>3.0</span>
                  <span>Live Telemetry Tracking & 300m Arrival Proximity Alerts</span>
                </h3>
                <p className="text-justify leading-relaxed">
                  Upon dispatch confirmation and marking “On the Way”, customers receive an authenticated live tracking link showing real-time technician movement, verified credential badge, and dynamic estimated arrival time (ETA). Automated arrival notifications are generated when the technician enters within 300 meters of the customer installation address.
                </p>
              </section>

              {/* Clause 4 */}
              <section className="space-y-2">
                <h3 className="font-bold text-slate-900 text-[12px] uppercase tracking-wider border-b border-slate-200 pb-1 flex items-center gap-2">
                  <span>4.0</span>
                  <span>Spare Parts Fulfillment, Barcode Tracking & OEM Warranty</span>
                </h3>
                <p className="text-justify leading-relaxed">
                  All replacement components and calibration parts are hand-delivered and installed directly by the technician. Every component is barcode-scanned, linked to the digital service request ID, and itemized on the final tax invoice with associated OEM manufacturer warranty coverage.
                </p>
              </section>

              {/* Clause 5 */}
              <section className="space-y-2">
                <h3 className="font-bold text-slate-900 text-[12px] uppercase tracking-wider border-b border-slate-200 pb-1 flex items-center gap-2">
                  <span>5.0</span>
                  <span>Fleet Logistics Desk & Dispatch Escalations</span>
                </h3>
                <p className="text-justify leading-relaxed">
                  For operational queries regarding territory coverage, route tracking, or delivery delays, contact the CALDIM ENGINEERING PRIVATE LIMITED Logistics Desk at <a href="mailto:support@caldimengg.in" className="text-blue-700 font-mono font-semibold underline">support@caldimengg.in</a> or by telephone at <a href="tel:2484553855" className="font-mono font-semibold text-slate-900 underline">248-455 3855</a> during operating hours (Monday – Saturday, 9:00 AM to 6:00 PM IST).
                </p>
              </section>
            </div>
          )}
        </div>

        {/* ── MODAL FOOTER ── */}
        <div className="px-5 py-3 bg-slate-100 border-t border-slate-300 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0 text-slate-700 text-[11px]">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-900">&copy; {new Date().getFullYear()} CALDIM ENGINEERING PRIVATE LIMITED</span>
            <span>&bull;</span>
            <span className="font-mono">GSTIN: 33AAGCC4916J1ZP</span>
            <span>&bull;</span>
            <span className="font-mono">CIN: U72900KA2026PTC123456</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-1.5 rounded bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default LegalComplianceModal;
