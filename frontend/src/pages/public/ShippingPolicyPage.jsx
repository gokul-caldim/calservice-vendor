import React from 'react';
import { LegalLayout } from './LegalLayout.jsx';
import {
  Truck,
  MapPin,
  Clock,
  PackageCheck,
  ShieldCheck,
  Navigation,
  Compass,
  AlertCircle,
} from 'lucide-react';

export function ShippingPolicyPage() {
  return (
    <LegalLayout
      title="Service Delivery & Fulfillment Policy"
      subtitle="Fulfillment mechanics, operational service territories, arrival time slots, and on-site hardware delivery standards."
      activeTab="shipping"
    >
      <div className="space-y-8 text-slate-800 text-xs leading-relaxed text-justify">
        {/* ── Overview Callout ── */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
          <div className="font-bold text-blue-950 flex items-center gap-1.5">
            <Truck className="w-4 h-4 text-blue-600" />
            <span>On-Demand Field Service Fulfillment Model</span>
          </div>
          <p className="text-blue-900 text-[11px] leading-relaxed">
            CalServices provides precision on-site technical diagnostics, calibration, electrical engineering, and appliance repair services. As a field service platform, <strong>“Delivery”</strong> refers to the dispatch and physical arrival of certified technicians at the customer’s specified premises, along with on-site delivery and installation of verified replacement parts and hardware.
          </p>
        </div>

        {/* ── 1. Operational Service Territories & Geofencing ── */}
        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
            <MapPin className="w-4 h-4 text-blue-600" />
            <span>1. Operational Coverage & Service Geofencing</span>
          </h2>
          <p>
            CalServices operates across designated municipal and metropolitan service zones:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-700">
            <li>
              <strong>20-Kilometer Dispatch Radius:</strong> Our automatic dispatch engine evaluates and matches bookings strictly to active, certified technicians located within a 20km geographic radius of the customer's service address to ensure prompt arrival.
            </li>
            <li>
              <strong>Service Territory Verification:</strong> Customers must enter their verified address or drop a GPS pin during booking. If an address falls outside our active municipal coverage zone, the booking request will be safely declined prior to payment.
            </li>
          </ul>
        </section>

        {/* ── 2. Fulfillment Timelines & Time Windows ── */}
        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
            <Clock className="w-4 h-4 text-blue-600" />
            <span>2. Appointment Slots & Arrival Windows</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-3 border border-slate-200 rounded-lg bg-slate-50 space-y-1">
              <p className="font-bold text-slate-900">Scheduled Service Bookings</p>
              <p className="text-[11px] text-slate-600">
                Customers select a 2-hour appointment window (e.g. 10:00 AM – 12:00 PM). Technicians are scheduled to arrive within the designated window.
              </p>
            </div>

            <div className="p-3 border border-slate-200 rounded-lg bg-slate-50 space-y-1">
              <p className="font-bold text-slate-900">Express On-Demand Dispatch</p>
              <p className="text-[11px] text-slate-600">
                For emergency HVAC or electrical breakdowns, express dispatch targets technician arrival within 45 to 90 minutes of booking confirmation.
              </p>
            </div>
          </div>
        </section>

        {/* ── 3. Live Customer Tracking & Telemetry ── */}
        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
            <Navigation className="w-4 h-4 text-blue-600" />
            <span>3. Real-Time Tracking & Arrival Notifications</span>
          </h2>
          <p>
            To ensure complete transparency and safety:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-700">
            <li>Once the technician accepts the dispatch offer and taps <em>“On the Way”</em>, the customer receives an SMS and email with a secure live tracking link.</li>
            <li>Customers can view their technician's real-time vehicle movement, name, photo, and dynamic estimated arrival time (ETA).</li>
            <li>Upon reaching within 300 meters of the service location, an automated arrival alert is triggered.</li>
          </ul>
        </section>

        {/* ── 4. Spare Parts Delivery & Hardware Installation ── */}
        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
            <PackageCheck className="w-4 h-4 text-blue-600" />
            <span>4. Hardware, Spare Parts & Inventory Fulfillment</span>
          </h2>
          <p>
            Where replacement components or calibration hardware are required:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-700">
            <li><strong>Direct Technician Hand-Delivery:</strong> Genuine OEM replacement parts are carried in the technician's mobile inventory van or collected from regional CalServices micro-warehouses.</li>
            <li><strong>Serialized Tracking:</strong> Every installed spare part is scanned and logged in the digital job record with its unique serial code, manufacturer warranty duration, and invoice line item.</li>
            <li><strong>Customer Pre-Approval:</strong> No part is installed without prior digital authorization and price agreement from the customer.</li>
          </ul>
        </section>

        {/* ── 5. Delivery Delays & Force Majeure ── */}
        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
            <Compass className="w-4 h-4 text-blue-600" />
            <span>5. Traffic, Severe Weather & Delay Protocols</span>
          </h2>
          <p>
            In the event of severe traffic gridlock, extreme rainfall, or road blockages, the technician or central dispatch team will contact the customer via phone with an updated ETA. If the delay exceeds 45 minutes past the slot window, the customer may reschedule without penalty or request a priority backup technician.
          </p>
        </section>

        {/* ── 6. Contact Logistics Desk ── */}
        <section className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
          <h3 className="font-bold text-slate-900 text-xs">Questions about service coverage or an active dispatch?</h3>
          <p className="text-[11px] text-slate-600">
            Contact the CALDIM ENGINEERING PRIVATE LIMITED Fleet Logistics Desk at <a href="mailto:support@caldimengg.in" className="text-blue-600 font-mono font-bold hover:underline">support@caldimengg.in</a> or call our central dispatch desk at <a href="tel:2484553855" className="text-blue-600 font-mono font-bold hover:underline">248-455 3855</a>.
          </p>
        </section>
      </div>
    </LegalLayout>
  );
}

export default ShippingPolicyPage;
