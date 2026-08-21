import React, { useState } from 'react';
import { LegalLayout } from './LegalLayout.jsx';
import {
  HelpCircle,
  Phone,
  Mail,
  MapPin,
  Clock,
  Send,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Headphones,
  ShieldAlert,
  FileCheck,
  Zap,
  Loader2,
  Copy,
  Check,
} from 'lucide-react';
import { apiSubmitSupportInquiry } from '../../api/workforceService.js';

export function SupportAndContactPage() {
  const [ticketForm, setTicketForm] = useState({
    name: '',
    email: '',
    phone: '',
    userType: 'technician',
    category: 'onboarding',
    priority: 'medium',
    subject: '',
    message: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ticketResult, setTicketResult] = useState(null);
  const [submitError, setSubmitError] = useState('');
  const [copied, setCopied] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState(0);

  const handleInputChange = (e) => {
    setTicketForm({
      ...ticketForm,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmitTicket = async (e) => {
    e.preventDefault();
    setSubmitError('');
    if (!ticketForm.name || !ticketForm.email || !ticketForm.message) {
      setSubmitError('Please complete all required fields.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await apiSubmitSupportInquiry({
        name: ticketForm.name.trim(),
        email: ticketForm.email.trim(),
        phone: ticketForm.phone.trim(),
        category: ticketForm.category,
        subject: ticketForm.subject.trim(),
        message: ticketForm.message.trim(),
      });

      setTicketResult({
        ticketId: res?.ticket_id || `CAL-${Math.floor(100000 + Math.random() * 900000)}`,
        submittedAt: res?.submitted_at || new Date().toLocaleString(),
        email: ticketForm.email,
        category: ticketForm.category,
        subject: ticketForm.subject || 'Operations Support',
      });
      setTicketForm({
        name: '',
        email: '',
        phone: '',
        userType: 'technician',
        category: 'onboarding',
        priority: 'medium',
        subject: '',
        message: '',
      });
    } catch (err) {
      console.error('Failed to submit ticket:', err);
      setSubmitError(err?.message || 'Unable to submit ticket. Please email support@caldimengg.in directly.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const faqs = [
    {
      q: 'How does the 6-Digit Customer OTP work at the service site?',
      a: 'When you arrive at the customer location and mark "Arrived" within the 300m geofence, a 6-digit start code is displayed on the customer’s booking portal. You must input this code into your mobile interface to transition the job to "In Progress" and begin work.',
    },
    {
      q: 'What should I do if my onboarding application is marked "Correction Required"?',
      a: 'Log in to your Workforce account and navigate to the Corrections panel. Review the administrator’s specific rejection reason (e.g., blurry ID photo, expired electrical certificate), upload the updated document, and click "Resubmit for Review". Resubmissions are reviewed within 4 hours.',
    },
    {
      q: 'Why am I not receiving automated dispatch offers?',
      a: 'Ensure all 5 operational gates are satisfied: (1) Your onboarding account is approved, (2) Mandatory KYC & compliance documents are valid and not expired, (3) You have clocked in and toggled your status to "Online", (4) You have active approved service categories, and (5) You are within 20km of the customer service request.',
    },
    {
      q: 'How and when are technician payouts settled?',
      a: 'Earnings from completed jobs and approved work extensions are audited automatically. Payouts are transferred every Tuesday via direct NEFT/ACH bank transfer or UPI into your registered bank account.',
    },
    {
      q: 'How do I handle unexpected repairs or spare parts on site?',
      a: 'Open the active job in your technician portal, tap "Request Work Extension / Add Parts", itemize the required hardware and labor, and submit. The customer will receive an immediate approval prompt on their phone. Once approved, the supplemental invoice is created automatically.',
    },
  ];

  return (
    <LegalLayout
      title="Support, Help Desk & Contact Operations"
      subtitle="Direct access to CalServices technical operations, emergency dispatch desk, technician onboarding support, and dispute resolution."
      activeTab="support"
    >
      <div className="space-y-10">
        {/* ── 3 Direct Channel Cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1 */}
          <div className="p-4 border border-blue-200 bg-blue-50/60 rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-blue-900 font-bold text-xs uppercase tracking-wider">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>9:00 AM to 6:00 PM Service</span>
            </div>
            <p className="text-[11px] text-slate-600">
              For active on-road technicians and in-progress job inquiries.
            </p>
            <div className="pt-2 text-xs font-mono font-bold text-slate-900">
              <a href="tel:2484553855" className="hover:text-blue-600 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-blue-600" />
                <span>Office: 248-455 3855</span>
              </a>
            </div>
            <div className="text-[10px] text-slate-500 font-medium">
              Monday to Saturday, 9:00 AM to 6:00 PM
            </div>
          </div>

          {/* Card 2 */}
          <div className="p-4 border border-emerald-200 bg-emerald-50/60 rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs uppercase tracking-wider">
              <FileCheck className="w-4 h-4 text-emerald-600" />
              <span>Onboarding & Compliance</span>
            </div>
            <p className="text-[11px] text-slate-600">
              Verification assistance, document corrections & trade approvals.
            </p>
            <div className="pt-2 text-xs font-mono font-bold text-slate-900">
              <a href="mailto:support@caldimengg.in" className="hover:text-emerald-700 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-emerald-600" />
                <span>support@caldimengg.in</span>
              </a>
            </div>
            <div className="text-[10px] text-slate-500 font-medium">
              SLA: Reviewed within 4 business hours
            </div>
          </div>

          {/* Card 3 */}
          <div className="p-4 border border-indigo-200 bg-indigo-50/60 rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-indigo-900 font-bold text-xs uppercase tracking-wider">
              <Headphones className="w-4 h-4 text-indigo-600" />
              <span>Corporate & General Help</span>
            </div>
            <p className="text-[11px] text-slate-600">
              Booking rescheduling, payment verification & billing inquiries.
            </p>
            <div className="pt-2 text-xs font-mono font-bold text-slate-900">
              <a href="mailto:support@caldimengg.in" className="hover:text-indigo-600 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-indigo-600" />
                <span>support@caldimengg.in</span>
              </a>
            </div>
            <div className="text-[10px] text-slate-500 font-medium">
              Monday – Saturday, 8:00 AM – 8:00 PM
            </div>
          </div>
        </div>

        {/* ── Support Ticket Submission Form ── */}
        <div className="border border-slate-200 rounded-lg p-6 bg-white space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Send className="w-4 h-4 text-blue-600" />
              <span>Submit an Operations Support Ticket</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Submit your inquiry directly to our platform response team. You will receive a tracking ID instantly.
            </p>
          </div>

          {ticketResult && (
            <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-2 animate-fade-in">
              <div className="flex items-center gap-2 font-bold text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Support Ticket Created Successfully! Reference: {ticketResult.ticketId}</span>
              </div>
              <p className="text-[11px] text-emerald-800">
                A confirmation has been logged for <strong>{ticketResult.email}</strong> under category <em>{ticketResult.category}</em>. Our support desk will respond shortly.
              </p>
              <button
                type="button"
                onClick={() => setTicketResult(null)}
                className="text-[11px] text-emerald-700 font-bold underline hover:text-emerald-900"
              >
                Submit another inquiry
              </button>
            </div>
          )}

          {!ticketResult && (
            <form onSubmit={handleSubmitTicket} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Your Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={ticketForm.name}
                    onChange={handleInputChange}
                    placeholder="e.g. Dave Sharma"
                    required
                    className="w-full px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Email Address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={ticketForm.email}
                    onChange={handleInputChange}
                    placeholder="e.g. dave.tech@calservices.com"
                    required
                    className="w-full px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Mobile Number
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={ticketForm.phone}
                    onChange={handleInputChange}
                    placeholder="e.g. +1 555-0199"
                    className="w-full px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    I am a...
                  </label>
                  <select
                    name="userType"
                    value={ticketForm.userType}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2"
                  >
                    <option value="technician">Field Technician / Engineer</option>
                    <option value="customer">Customer / Homeowner / Business</option>
                    <option value="partner">Corporate Partner / Contractor</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Inquiry Category
                  </label>
                  <select
                    name="category"
                    value={ticketForm.category}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2"
                  >
                    <option value="onboarding">Technician Onboarding & KYC</option>
                    <option value="login_access">Sign In & Account Access</option>
                    <option value="dispatch_otp">Active Dispatch & OTP Verification</option>
                    <option value="payments">Weekly Payouts & Invoicing</option>
                    <option value="app_bug">Mobile App or Portal Issue</option>
                    <option value="dispute">Service Quality & Dispute</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Priority Level
                  </label>
                  <select
                    name="priority"
                    value={ticketForm.priority}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2"
                  >
                    <option value="low">Low (General Inquiry)</option>
                    <option value="medium">Medium (Account / Payout)</option>
                    <option value="urgent">Urgent (Active Job in Progress)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Subject / Summary <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  name="subject"
                  value={ticketForm.subject}
                  onChange={handleInputChange}
                  placeholder="Brief summary of your question or issue"
                  required
                  className="w-full px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Detailed Description <span className="text-rose-500">*</span>
                </label>
                <textarea
                  name="message"
                  rows={4}
                  value={ticketForm.message}
                  onChange={handleInputChange}
                  placeholder="Please provide all relevant details, error messages, or booking reference numbers..."
                  required
                  className="w-full px-3 py-2 resize-y"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Submitting Ticket...' : 'Submit Support Ticket'}</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* ── Operational FAQ Section ── */}
        <div className="space-y-4">
          <div className="border-b border-slate-200 pb-2">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-blue-600" />
              <span>Frequently Asked Operational Questions (FAQ)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Quick answers to common questions about field dispatch, verification, and payments.
            </p>
          </div>

          <div className="space-y-2">
            {faqs.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={idx}
                  className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-xs"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? -1 : idx)}
                    className="w-full p-3.5 text-left font-bold text-xs text-slate-900 bg-slate-50/50 hover:bg-slate-50 flex items-center justify-between gap-3 transition-colors"
                  >
                    <span>{faq.q}</span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="p-4 text-xs text-slate-700 bg-white border-t border-slate-100 leading-relaxed">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Corporate Identity & Operational Centers ── */}
        <div className="border-t border-slate-200 pt-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                CALDIM ENGINEERING PRIVATE LIMITED
              </h3>
              <p className="text-[11px] text-slate-500">
                Official Corporate Headquarters & Workforce Operations Hub
              </p>
            </div>
            <div className="text-[11px] font-mono text-slate-600 space-x-3">
              <span>GSTIN: <strong>33AAGCC4916J1ZP</strong></span>
              <span>&bull;</span>
              <span>CIN: <strong>U72900KA2026PTC123456</strong></span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-600">
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
              <p className="font-bold text-slate-900 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-blue-600" />
                <span>Registered & Corporate Office</span>
              </p>
              <p className="text-[11px] text-slate-700 leading-snug">
                Minmac center #118, First Floor, Arcot Road,<br />
                Valasaravalakkam, Chennai - 600087,<br />
                Tamil Nadu, India.
              </p>
              <p className="text-[11px] pt-1">
                Email: <a href="mailto:support@caldimengg.in" className="text-blue-600 font-mono font-semibold underline">support@caldimengg.in</a>
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
              <p className="font-bold text-slate-900 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                <span>Central Operations & Dispatch Desk</span>
              </p>
              <p className="text-[11px] text-slate-700 leading-snug">
                Monday to Saturday, 9:00 AM to 6:00 PM Field Engineering Telemetry & Technician Routing<br />
                Office Phone: <a href="tel:2484553855" className="font-mono font-semibold text-blue-600 hover:underline">248-455 3855</a><br />
                Operations Support SLA: Under 15 Minutes for Active In-Field Dispatches.
              </p>
            </div>
          </div>
        </div>
      </div>
    </LegalLayout>
  );
}

export default SupportAndContactPage;
