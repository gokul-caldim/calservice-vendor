import React, { useState } from 'react';
import { LegalLayout } from './LegalLayout.jsx';
import {
  Shield,
  Lock,
  Eye,
  Database,
  Smartphone,
  MapPin,
  Download,
  Trash2,
  Server,
  UserCheck,
} from 'lucide-react';

export function PrivacyPolicyPage() {
  const [activeSection, setActiveSection] = useState('data-collected');

  const sections = [
    { id: 'data-collected', title: '1. Information We Collect' },
    { id: 'gps-telemetry', title: '2. Real-Time GPS & Telemetry Tracking' },
    { id: 'how-we-use', title: '3. How Your Information Is Used' },
    { id: 'tenant-security', title: '4. Tenant Isolation & Database Security' },
    { id: 'data-sharing', title: '5. Third-Party Data Sharing & Disclosure' },
    { id: 'data-retention', title: '6. Data Retention & Archival' },
    { id: 'user-rights', title: '7. Your Rights (Dossier Export & Deletion)' },
    { id: 'cookies-sessions', title: '8. Session Tokens & Authentication Security' },
    { id: 'privacy-contact', title: '9. Data Protection Officer & Privacy Inquiries' },
  ];

  return (
    <LegalLayout
      title="Privacy & Telemetry Policy"
      subtitle="How CalServices collects, encrypts, processes, and protects your personal, operational, and geospatial data."
      activeTab="privacy"
    >
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Table of Contents */}
        <aside className="lg:col-span-1 border-b lg:border-b-0 lg:border-r border-slate-200 pb-6 lg:pb-0 lg:pr-6">
          <div className="sticky top-28 space-y-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Policy Sections
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

            <div className="mt-6 p-3 bg-emerald-50/80 border border-emerald-200 rounded text-slate-700 text-[11px] space-y-1.5">
              <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-600" />
                <span>Enterprise Privacy Shield</span>
              </div>
              <p className="text-slate-600 leading-snug">
                Data stored in isolated multi-tenant PostgreSQL schemas with AES-256 encryption at rest and TLS 1.3 in transit.
              </p>
            </div>
          </div>
        </aside>

        {/* Content Body */}
        <div className="lg:col-span-3 space-y-8 text-slate-800 text-xs leading-relaxed text-justify">
          {/* Section 1 */}
          <section id="data-collected" className="space-y-3 scroll-mt-28">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
              <UserCheck className="w-4 h-4 text-blue-600" />
              <span>1.0 Information Collection & Processing Scope</span>
            </h2>
            <p className="text-justify leading-relaxed">
              When you use CalServices, we collect information essential for coordinating field service engineering, customer dispatch, payment settlement, and compliance verification:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-700">
              <li>
                <strong>Technician Profile & KYC Data:</strong> Legal full name, phone number, email address, physical address, emergency contact, tax identification, and government ID scans.
              </li>
              <li>
                <strong>Trade Qualifications:</strong> Technical certifications, license numbers, skill tags, calibration accreditations, and verification documents.
              </li>
              <li>
                <strong>Customer Service Data:</strong> Service location addresses, device makes/models, reported problem symptoms, access instructions, and appointment preferences.
              </li>
              <li>
                <strong>Operational Media & Proof:</strong> Pre-service appliance diagnostic photos, post-service completion photos, job extension logs, and signature records.
              </li>
            </ul>
          </section>

          {/* Section 2 */}
          <section id="gps-telemetry" className="space-y-3 scroll-mt-28">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
              <MapPin className="w-4 h-4 text-blue-600" />
              <span>2. Real-Time GPS & Telemetry Tracking</span>
            </h2>
            <div className="bg-blue-50 border border-blue-200 rounded p-3.5 space-y-2">
              <p className="font-semibold text-blue-950">
                Active Duty Geolocation Policy:
              </p>
              <p className="text-blue-900">
                CalServices accesses device GPS coordinates only when a technician is logged in and is either <em>Clocked In</em> for a shift or has marked a job as <em>“On the Way”</em>. Real-time telemetry is transmitted to:
              </p>
              <ul className="list-disc pl-4 space-y-1 text-blue-800">
                <li>Provide customers with a live ETA and map view of their technician's arrival.</li>
                <li>Calculate 300m geofence proximity arrival triggers.</li>
                <li>Ensure field safety and rapid incident dispatch.</li>
              </ul>
              <p className="text-[11px] text-blue-700 italic">
                GPS telemetry is strictly disabled when the technician clocks out or marks themselves Offline.
              </p>
            </div>
          </section>

          {/* Section 3 */}
          <section id="how-we-use" className="space-y-3 scroll-mt-28">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
              <Eye className="w-4 h-4 text-blue-600" />
              <span>3. How Your Information Is Used</span>
            </h2>
            <p>We process collected data exclusively for authorized business operations:</p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-700">
              <li><strong>Dispatch Optimization:</strong> Matching service requests to the most qualified nearby technician based on active skills and 20km geographic territory.</li>
              <li><strong>Service Verification:</strong> Ensuring service authenticity through cryptographic OTP validation and photographic records.</li>
              <li><strong>Financial Transactions:</strong> Processing technician weekly payouts, customer digital invoices, and accounting compliance.</li>
              <li><strong>Fraud Prevention:</strong> Detecting duplicate accounts, unauthorized credential sharing, or spoofed location telemetry.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section id="tenant-security" className="space-y-3 scroll-mt-28">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
              <Server className="w-4 h-4 text-blue-600" />
              <span>4. Tenant Isolation & Database Security</span>
            </h2>
            <p>
              The CalServices backend is built on Supabase PostgreSQL with strict multi-tenant isolation:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-700">
              <li><strong>Zero Cross-Tenant Leakage:</strong> Every operational record is bound to the verified tenant company context. One company’s managers or technicians cannot access another vendor’s customer or job data.</li>
              <li><strong>Role-Based Access Control (RBAC):</strong> Administrative rights, document verification authorizations, and payout views are segregated by strict server-side validation.</li>
              <li><strong>Encrypted Transport:</strong> All API communication is enforced over HTTPS with TLS 1.3 encryption.</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section id="data-sharing" className="space-y-3 scroll-mt-28">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
              <Database className="w-4 h-4 text-blue-600" />
              <span>5. Third-Party Data Sharing & Disclosure</span>
            </h2>
            <p>
              CalServices does not sell, rent, or monetize your personal data. Data is shared only with verified technical partners:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-700">
              <li><strong>Payment Gateways:</strong> Razorpay and Stripe for secure payment tokenization and automated bank disbursements.</li>
              <li><strong>Geocoding & Maps:</strong> Mapbox / OpenStreetMap for geofencing and routing navigation.</li>
              <li><strong>Cloud Storage:</strong> Secure AWS / Supabase Storage for encrypted document files and proof photos.</li>
              <li><strong>Legal Compliance:</strong> When required by binding court orders or statutory government regulations.</li>
            </ul>
          </section>

          {/* Section 6 */}
          <section id="data-retention" className="space-y-3 scroll-mt-28">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
              <Smartphone className="w-4 h-4 text-blue-600" />
              <span>6. Data Retention & Archival</span>
            </h2>
            <p>
              We retain active account and service data for the duration of the account’s operational lifecycle. Financial transactions, proof-of-work media, and tax invoices are archived for seven (7) years in compliance with statutory audit regulations.
            </p>
          </section>

          {/* Section 7 */}
          <section id="user-rights" className="space-y-3 scroll-mt-28">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
              <Download className="w-4 h-4 text-blue-600" />
              <span>7. Your Rights (Dossier Export & Deletion)</span>
            </h2>
            <p>
              You maintain full control over your personal data:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="p-3 border border-slate-200 rounded bg-slate-50 space-y-1">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5 text-blue-600" />
                  <span>Right to Data Portability</span>
                </div>
                <p className="text-slate-600 text-[11px]">
                  Technicians can instantly download an official, machine-readable JSON export of their verified profile, skill endorsements, and job history from their Settings panel.
                </p>
              </div>

              <div className="p-3 border border-slate-200 rounded bg-slate-50 space-y-1">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>Right to Account Deactivation</span>
                </div>
                <p className="text-slate-600 text-[11px]">
                  Users may request account deactivation at any time once open service obligations and payments have settled.
                </p>
              </div>
            </div>
          </section>

          {/* Section 8 */}
          <section id="cookies-sessions" className="space-y-3 scroll-mt-28">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
              <Lock className="w-4 h-4 text-blue-600" />
              <span>8. Session Tokens & Authentication Security</span>
            </h2>
            <p>
              CalServices uses secure HTTP session cookies and JSON Web Tokens (JWT) for authentication. We implement CSRF protection, secure header sanitization, and automatic token expiration to prevent unauthorized session hijacking.
            </p>
          </section>

          {/* Section 9 */}
          <section id="privacy-contact" className="space-y-3 scroll-mt-28">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
              <Shield className="w-4 h-4 text-blue-600" />
              <span>9. Data Protection Officer & Privacy Inquiries</span>
            </h2>
            <p>
              For questions regarding this policy or to exercise your statutory privacy rights, contact our Data Governance & Compliance Office:
            </p>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded text-slate-700 text-[11px] space-y-1">
              <p><strong>Corporate Entity:</strong> CALDIM ENGINEERING PRIVATE LIMITED</p>
              <p><strong>Address:</strong> Minmac center #118, First Floor, Arcot Road, Valasaravalakkam, Chennai - 600087, Tamil Nadu, India</p>
              <p><strong>Email:</strong> <a href="mailto:support@caldimengg.in" className="text-blue-600 font-mono font-bold hover:underline">support@caldimengg.in</a></p>
              <p><strong>Attn:</strong> Data Protection Officer & Privacy Desk</p>
              <p><strong>Response SLA:</strong> Inquiries are addressed within 48 business hours.</p>
            </div>
          </section>
        </div>
      </div>
    </LegalLayout>
  );
}

export default PrivacyPolicyPage;
