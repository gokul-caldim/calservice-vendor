import React from 'react';
import { LegalLayout } from './LegalLayout.jsx';
import {
  RotateCcw,
  Clock,
  ShieldCheck,
  AlertTriangle,
  CreditCard,
  CheckCircle2,
  FileText,
  DollarSign,
  HelpCircle,
} from 'lucide-react';

export function CancellationRefundsPage() {
  return (
    <LegalLayout
      title="Cancellation & Refund Policy"
      subtitle="Operational rules, cancellation windows, refund timelines, and technician dispatch compensation guidelines."
      activeTab="refunds"
    >
      <div className="space-y-8 text-slate-800 text-xs leading-relaxed text-justify">
        {/* ── Summary Strip ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg space-y-1">
            <div className="font-bold text-emerald-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>100% Full Refund</span>
            </div>
            <p className="text-[11px] text-emerald-800">
              When cancelled prior to technician dispatch or if no qualified technician is available.
            </p>
          </div>

          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg space-y-1">
            <div className="font-bold text-amber-900 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-600" />
              <span>5–7 Business Days</span>
            </div>
            <p className="text-[11px] text-amber-800">
              Direct reversal to your original payment method (Cards, NetBanking, UPI, Wallets).
            </p>
          </div>

          <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-lg space-y-1">
            <div className="font-bold text-blue-900 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span>Fair Dispatch Guarantee</span>
            </div>
            <p className="text-[11px] text-blue-800">
              Technicians receive fair transit reimbursement if cancellation occurs after arrival.
            </p>
          </div>
        </div>

        {/* ── 1. Customer Cancellation Matrix ── */}
        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
            <RotateCcw className="w-4 h-4 text-blue-600" />
            <span>1. Customer Service Cancellation Rules</span>
          </h2>
          <p>
            Because CalServices reserves dedicated certified technician schedules and dispatches technicians in real time, cancellations are processed according to the operational phase of the service request:
          </p>

          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">Cancellation Timing</th>
                  <th className="p-3">Refund Eligibility</th>
                  <th className="p-3">Transit / Convenience Fee</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <tr>
                  <td className="p-3 font-semibold text-slate-900">Before Technician Dispatch / Unassigned</td>
                  <td className="p-3 text-emerald-700 font-bold">100% Full Refund</td>
                  <td className="p-3 text-slate-500">Nil ($0.00 / ₹0)</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-slate-900">En Route (“On the Way”)</td>
                  <td className="p-3 text-emerald-700 font-semibold">Full Service Fee Refunded</td>
                  <td className="p-3 text-amber-700">Nominal fuel transit allowance credited to technician</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-slate-900">Arrived at Site (Prior to OTP Verification)</td>
                  <td className="p-3 text-slate-800">Refund minus standard on-site diagnostic fee</td>
                  <td className="p-3 text-slate-600">Standard diagnostic inspection fee applies</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-slate-900">Work Commenced (OTP Verified & In Progress)</td>
                  <td className="p-3 text-rose-700 font-semibold">Non-refundable for completed labor</td>
                  <td className="p-3 text-slate-600">Prorated on uninstalled parts and pending work</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ── 2. Technician Cancellation & Reassignment ── */}
        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
            <AlertTriangle className="w-4 h-4 text-blue-600" />
            <span>2. Technician Unavailability & Automatic Reassignment</span>
          </h2>
          <p>
            If an assigned technician experiences vehicle breakdown, sudden illness, or extreme weather:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-700">
            <li>The technician must immediately flag an operational cancellation in the Workforce app with a verified reason.</li>
            <li>Our automatic dispatch engine instantly re-broadcasts the booking to the nearest alternative certified technician to minimize customer delay.</li>
            <li>If no backup technician is available within 30 minutes of the requested slot, the customer is offered priority rescheduling or an immediate full refund.</li>
          </ul>
        </section>

        {/* ── 3. Refund Timelines & Processing ── */}
        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
            <CreditCard className="w-4 h-4 text-blue-600" />
            <span>3. Refund Settlement Timelines</span>
          </h2>
          <p>
            All authorized refunds are submitted directly to the payment gateway within 24 hours of approval:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-700">
            <li><strong>Credit / Debit Cards:</strong> 5 to 7 business days, depending on your issuing bank's clearing cycle.</li>
            <li><strong>UPI & Instant Wallets:</strong> Typically credited within 2 to 24 hours.</li>
            <li><strong>Net Banking:</strong> 3 to 5 business days.</li>
            <li><strong>Cash-on-Delivery (COD) Refunds:</strong> Transferred electronically via direct NEFT bank payout or UPI upon submission of bank account details to our support desk.</li>
          </ul>
        </section>

        {/* ── 4. Dispute Resolution & Proof Inspection ── */}
        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
            <FileText className="w-4 h-4 text-blue-600" />
            <span>4. Quality Disputes & 30-Day Service Guarantee</span>
          </h2>
          <p>
            CalServices provides a <strong>30-Day Workmanship Guarantee</strong> on all standard repairs and calibration services:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-700">
            <li>If a serviced appliance exhibits the same defect within 30 days, a senior specialist will be dispatched free of charge for re-inspection.</li>
            <li>Dispute claims are evaluated by examining the pre-service photos, post-service proof photos, and technician diagnostic telemetry logged in the database.</li>
            <li>If defective replacement parts were installed, the manufacturer warranty replacement or refund will be executed promptly.</li>
          </ul>
        </section>

        {/* ── 5. How to Request a Cancellation or Refund ── */}
        <section className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
          <h3 className="font-bold text-slate-900 text-xs">Need to cancel a booking or request a refund?</h3>
          <p className="text-[11px] text-slate-600">
            Customers can initiate cancellation directly from the tracking link provided in your SMS/Email confirmation, or by contacting CALDIM ENGINEERING PRIVATE LIMITED at <a href="mailto:support@caldimengg.in" className="text-blue-600 font-mono font-bold hover:underline">support@caldimengg.in</a> or calling <a href="tel:2484553855" className="text-blue-600 font-mono font-bold hover:underline">248-455 3855</a> with your Booking Reference ID.
          </p>
        </section>
      </div>
    </LegalLayout>
  );
}

export default CancellationRefundsPage;
