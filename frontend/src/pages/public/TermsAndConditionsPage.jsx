import React, { useState } from 'react';
import { LegalLayout } from './LegalLayout.jsx';
import {
  FileText,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Scale,
  CreditCard,
  Camera,
  MapPin,
  Clock,
  Briefcase,
} from 'lucide-react';

export function TermsAndConditionsPage() {
  const [activeSection, setActiveSection] = useState('overview');

  const sections = [
    { id: 'overview', title: '1. Overview & Service Scope' },
    { id: 'technician-eligibility', title: '2. Technician Eligibility & KYC Verification' },
    { id: 'dispatch-execution', title: '3. Dispatch, Real-Time Tracking & OTP Verification' },
    { id: 'proof-quality', title: '4. Proof of Work & Quality Standards' },
    { id: 'payments-pricing', title: '5. Payments, Cash Collection & Surcharges' },
    { id: 'parts-extensions', title: '6. Spare Parts, Hardware & Work Extensions' },
    { id: 'conduct-safety', title: '7. Code of Conduct & Workplace Safety' },
    { id: 'liability-indemnity', title: '8. Limitation of Liability & Indemnity' },
    { id: 'termination', title: '9. Suspension, Account Termination & Dispute Resolution' },
  ];

  return (
    <LegalLayout
      title="Terms of Service & Operational Agreement"
      subtitle="Standard operational rules, technician responsibilities, service fulfillment terms, and platform agreements for CalServices Workforce & Field Operations."
      activeTab="terms"
    >
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sticky Sidebar Navigation */}
        <aside className="lg:col-span-1 border-b lg:border-b-0 lg:border-r border-slate-200 pb-6 lg:pb-0 lg:pr-6">
          <div className="sticky top-28 space-y-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Table of Contents
            </div>
            <nav className="space-y-1">
              {sections.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  onClick={() => setActiveSection(s.id)}
                  className={`block text-xs py-1.5 px-2 rounded transition-colors ${
                    activeSection === s.id
                      ? 'bg-blue-50 text-blue-700 font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {s.title}
                </a>
              ))}
            </nav>

            <div className="mt-6 p-3 bg-blue-50/70 border border-blue-100 rounded text-slate-700 text-[11px] space-y-1.5">
              <div className="font-bold text-blue-900 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>Verified Legal Baseline</span>
              </div>
              <p className="text-slate-600 leading-snug">
                These terms govern all marketplace service bookings, dispatch assignments, and operational execution.
              </p>
            </div>
          </div>
        </aside>

        {/* Main Terms Body */}
        <div className="lg:col-span-3 space-y-8 text-slate-800 text-xs leading-relaxed text-justify">
          {/* Section 1 */}
          <section id="overview" className="space-y-3 scroll-mt-28">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
              <Briefcase className="w-4 h-4 text-blue-600" />
              <span>1.0 Overview & Platform Scope</span>
            </h2>
            <p className="text-justify leading-relaxed">
              Welcome to <strong>CalServices</strong> (“Platform”, “we”, “us”, or “our”), owned and operated by <strong>CALDIM ENGINEERING PRIVATE LIMITED</strong> (CIN: U72900KA2026PTC123456, GSTIN: 33AAGCC4916J1ZP), having its registered office at Minmac center #118, First Floor, Arcot Road, Valasaravalakkam, Chennai - 600087, Tamil Nadu, India.
            </p>
            <p className="text-justify leading-relaxed">
              CalServices provides a synchronized digital infrastructure connecting certified field service engineers, diagnostic technicians, and maintenance contractors (“Technicians” or “Service Providers”) with commercial, industrial, and residential customers (“Customers”).
            </p>
            <p className="text-justify leading-relaxed">
              By accessing, creating an account, onboarding as a field technician, or fulfilling service requests through the CalServices Workforce platform, you expressly agree to be bound by these Terms of Service, along with our <a href="/privacy" className="text-blue-600 font-semibold hover:underline">Privacy Policy</a>, <a href="/cancellation-refunds" className="text-blue-600 font-semibold hover:underline">Cancellation & Refund Policy</a>, and <a href="/shipping-policy" className="text-blue-600 font-semibold hover:underline">Service Delivery Policy</a>. Contact us at <a href="mailto:support@caldimengg.in" className="text-blue-600 font-bold hover:underline">support@caldimengg.in</a>.
            </p>
          </section>

          {/* Section 2 */}
          <section id="technician-eligibility" className="space-y-3 scroll-mt-28">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span>2. Technician Eligibility & KYC Verification</span>
            </h2>
            <p>
              To protect customers and maintain platform integrity, all technicians must complete a multi-gate verification process before being eligible for automatic job dispatch:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-700">
              <li>
                <strong>Government Identification:</strong> Technicians must submit valid government-issued photo identification (Aadhaar, National ID, Passport, or Driver's License) along with proof of address.
              </li>
              <li>
                <strong>Skill & Trade Certifications:</strong> Mandatory trade licenses, calibration certifications, electrical/HVAC credentials, or vocational certificates must be uploaded and approved by our operations compliance desk.
              </li>
              <li>
                <strong>Background Check:</strong> Technicians must pass criminal background and professional references screening.
              </li>
              <li>
                <strong>Ongoing Compliance:</strong> Compliance records are dynamically evaluated. Expired certifications immediately disqualify a technician from automatic dispatch until renewed.
              </li>
            </ul>
          </section>

          {/* Section 3 */}
          <section id="dispatch-execution" className="space-y-3 scroll-mt-28">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
              <MapPin className="w-4 h-4 text-blue-600" />
              <span>3. Dispatch, Real-Time Tracking & OTP Verification</span>
            </h2>
            <p>
              The CalServices platform relies on deterministic operational workflows:
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded p-3.5 space-y-2">
              <div className="font-semibold text-slate-900">Mandatory 4-Stage Service Lifecycle:</div>
              <ol className="list-decimal pl-4 space-y-1 text-slate-700">
                <li><strong>Offer Acceptance:</strong> Technician receives an automated job offer based on skill match and proximity (within a 20km service radius) with a 5-minute acceptance window.</li>
                <li><strong>En Route GPS Telemetry:</strong> Upon marking “On the Way”, continuous GPS telemetry is shared with the customer and operations control room for safety and ETA calculation.</li>
                <li><strong>Arrival & Geofence:</strong> Arrival is confirmed once within the designated customer geofence perimeter (300m).</li>
                <li><strong>6-Digit Customer OTP Verification:</strong> Work may only commence when the technician physically verifies the 6-digit one-time code provided by the customer. Bypassing OTP verification is strictly prohibited.</li>
              </ol>
            </div>
          </section>

          {/* Section 4 */}
          <section id="proof-quality" className="space-y-3 scroll-mt-28">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
              <Camera className="w-4 h-4 text-blue-600" />
              <span>4. Proof of Work & Quality Standards</span>
            </h2>
            <p>
              Technicians must document pre-service conditions and post-service completion:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-700">
              <li>
                <strong>Pre-Service Inspection Photos:</strong> Mandatory capture of device/appliance model serial plate, existing physical damage, and pre-repair diagnostic readings.
              </li>
              <li>
                <strong>Post-Service Completion Photos:</strong> Photographic evidence demonstrating operational readiness, replaced components, and a clean customer work area.
              </li>
              <li>
                <strong>Time Logging & Geostamps:</strong> All photographic proofs are embedded with immutable server timestamps and spatial coordinates.
              </li>
            </ul>
          </section>

          {/* Section 5 */}
          <section id="payments-pricing" className="space-y-3 scroll-mt-28">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
              <CreditCard className="w-4 h-4 text-blue-600" />
              <span>5. Payments, Cash Collection & Surcharges</span>
            </h2>
            <p>
              Pricing is strictly calculated by the platform catalog. Technicians may not quote unapproved off-platform rates:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-700">
              <li>
                <strong>Online Payments:</strong> Pre-paid bookings and supplemental payments processed via secure digital payment gateways (Razorpay, Stripe, UPI, Cards).
              </li>
              <li>
                <strong>Cash-on-Delivery (COD):</strong> If cash collection is authorized, the technician must record exact cash received in the mobile interface and provide the customer with a digital receipt.
              </li>
              <li>
                <strong>Disbursement Cycles:</strong> Technician earnings and commissions are settled weekly into verified bank accounts, subject to completed job audits.
              </li>
            </ul>
          </section>

          {/* Section 6 */}
          <section id="parts-extensions" className="space-y-3 scroll-mt-28">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>6. Spare Parts, Hardware & Work Extensions</span>
            </h2>
            <p>
              If unexpected defects require additional labor or replacement hardware:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-700">
              <li>Technicians must create a digital <strong>Work Extension Request</strong> with itemized parts and costs.</li>
              <li>The customer must digitally approve the extension from their portal or via OTP confirmation before parts are installed.</li>
              <li>All replacement parts must carry authorized manufacturer serials and platform warranty.</li>
            </ul>
          </section>

          {/* Section 7 */}
          <section id="conduct-safety" className="space-y-3 scroll-mt-28">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
              <AlertTriangle className="w-4 h-4 text-blue-600" />
              <span>7. Code of Conduct & Workplace Safety</span>
            </h2>
            <p>
              All platform participants must adhere to strict professional conduct:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-700">
              <li>Zero tolerance for harassment, discrimination, intoxication, or unsafe equipment handling.</li>
              <li>Technicians must wear standard personal protective equipment (PPE) where required.</li>
              <li>Direct off-platform solicitation of CalServices customers is a material breach resulting in immediate termination and financial forfeiture.</li>
            </ul>
          </section>

          {/* Section 8 */}
          <section id="liability-indemnity" className="space-y-3 scroll-mt-28">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
              <Scale className="w-4 h-4 text-blue-600" />
              <span>8. Limitation of Liability & Indemnity</span>
            </h2>
            <p>
              To the maximum extent permitted by applicable law, CalServices shall not be liable for indirect, incidental, punitive, or consequential damages resulting from unauthorized equipment tampering, preexisting property defects, or force majeure events. Technicians operate as verified independent service partners or affiliated company personnel.
            </p>
          </section>

          {/* Section 9 */}
          <section id="termination" className="space-y-3 scroll-mt-28">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
              <span>9. Suspension, Account Termination & Dispute Resolution</span>
            </h2>
            <p>
              CalServices reserves the right to temporarily suspend or permanently deactivate accounts for policy violations, repeated job cancellations, unverified document submission, or safety infractions.
            </p>
            <p>
              Any disputes arising under these terms shall be subject to amicable conciliation through the CalServices Operations Dispute Desk before seeking binding arbitration in accordance with regional jurisdiction laws.
            </p>
          </section>
        </div>
      </div>
    </LegalLayout>
  );
}

export default TermsAndConditionsPage;
