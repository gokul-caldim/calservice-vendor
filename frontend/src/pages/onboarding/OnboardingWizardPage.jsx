import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthProvider.jsx';
import { AppShell } from '../../components/common/AppShell.jsx';

import {
  apiGetOnboardingProfile,
  apiSaveOnboardingDraft,
  apiUploadDocument,
  apiSubmitOnboarding,
  apiGetCatalog,
} from '../../api/workforceService.js';
import { StatusBadge } from '../../components/enterprise/StatusBadge.jsx';
import { ErrorState } from '../../components/enterprise/ErrorState.jsx';
import { LoadingState } from '../../components/enterprise/LoadingState.jsx';
import {
  User,
  MapPin,
  Wrench,
  Award,
  FileText,
  CreditCard,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Upload,
  AlertCircle,
  HelpCircle,
  Lock,
} from 'lucide-react';


const STEPS = [
  { id: 1, label: 'Personal', icon: User },
  { id: 2, label: 'Address & Territory', icon: MapPin },
  { id: 3, label: 'Services', icon: Wrench },
  { id: 4, label: 'Skills & Tools', icon: Award },
  { id: 5, label: 'Documents', icon: FileText },
  { id: 6, label: 'Bank Details', icon: CreditCard },
  { id: 7, label: 'Review & Submit', icon: CheckCircle2 },
];

export function OnboardingWizardPage() {
  const { user, registrationStatus, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState(1);
  const [catalog, setCatalog] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const isLocked = ['approved', 'submitted', 'under_review'].includes(registrationStatus);

  // Form State
  const [formData, setFormData] = useState({
    personal: {
      dob: '',
      gender: '',
      emergencyName: '',
      emergencyPhone: '',
      emergencyRelation: '',
    },
    address: {
      street: '',
      city: '',
      state: '',
      pincode: '',
      serviceRadius: '',
    },
    services: [],
    skills: {
      experienceYears: '',
      tools: [],
      languages: [],
      vehicleType: '',
      licenseNumber: '',
    },
    documents: {},
    bank: {
      accountHolder: '',
      accountNumber: '',
      confirmAccountNumber: '',
      ifsc: '',
      bankName: '',
      upiId: '',
    },
    declarationAccepted: false,
  });

  // Load profile and catalog
  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);
        const [profile, catData] = await Promise.all([
          apiGetOnboardingProfile().catch(() => null),
          apiGetCatalog().catch(() => []),
        ]);

        if (catData && catData.length > 0) {
          setCatalog(catData);
        }

        if (profile && profile.onboarding_data) {
          const ob = profile.onboarding_data;
          const draft = ob.draft || {};

          setFormData((prev) => ({
            ...prev,
            personal: { ...prev.personal, ...(draft.personal || {}) },
            address: { ...prev.address, ...(draft.address || {}) },
            services: draft.services || prev.services,
            skills: { ...prev.skills, ...(draft.skills || {}) },
            documents: ob.documents || draft.documents || {},
            bank: { ...prev.bank, ...(draft.bank || {}) },
          }));

          if (ob.step && ob.step >= 1 && ob.step <= 7) {
            setCurrentStep(ob.step);
          }
        }
      } catch (_) {
        setError('Failed to load onboarding profile.');
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const saveCurrentDraft = async (nextStep = null) => {
    if (isLocked) {
      if (nextStep) setCurrentStep(nextStep);
      return;
    }
    try {
      setIsSaving(true);
      setError('');
      await apiSaveOnboardingDraft(nextStep || currentStep, {
        personal: formData.personal,
        address: formData.address,
        services: formData.services,
        skills: formData.skills,
        documents: formData.documents,
        bank: formData.bank,
      });
      if (nextStep) setCurrentStep(nextStep);
    } catch (err) {
      setError(err.message || 'Failed to save draft.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleNext = () => {
    if (isLocked) {
      if (currentStep < 7) setCurrentStep(currentStep + 1);
      return;
    }
    if (currentStep === 1) {
      if (!formData.personal.dob) {
        setError('Please enter your date of birth.');
        return;
      }
    } else if (currentStep === 2) {
      if (!formData.address.street || !formData.address.city || !formData.address.pincode) {
        setError('Please complete your address details.');
        return;
      }
    } else if (currentStep === 3) {
      if (formData.services.length === 0) {
        setError('Please select at least ONE service you provide.');
        return;
      }
    } else if (currentStep === 6) {
      if (!formData.bank.accountHolder || !formData.bank.accountNumber || !formData.bank.ifsc) {
        setError('Please complete your bank account details for direct deposit.');
        return;
      }
      if (formData.bank.accountNumber !== formData.bank.confirmAccountNumber) {
        setError('Account numbers do not match.');
        return;
      }
    }

    setError('');
    const next = currentStep + 1;
    saveCurrentDraft(next);
  };

  const handleBack = () => {
    setError('');
    if (currentStep > 1) {
      const prev = currentStep - 1;
      if (isLocked) {
        setCurrentStep(prev);
      } else {
        saveCurrentDraft(prev);
      }
    }
  };


  const handleFileUpload = async (category, file, title = '') => {
    try {
      setIsSaving(true);
      setError('');
      const res = await apiUploadDocument(category, file, title);
      setFormData((prev) => ({
        ...prev,
        documents: {
          ...prev.documents,
          [category]: res.document,
        },
      }));
      setSuccessMsg(`Document ${category} uploaded!`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to upload document.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleService = (svc) => {
    const exists = formData.services.some((s) => s.id === svc.id);
    let updated;
    if (exists) {
      updated = formData.services.filter((s) => s.id !== svc.id);
    } else {
      updated = [...formData.services, { id: svc.id, name: svc.name, category: svc.category_name || '' }];
    }
    setFormData((prev) => ({ ...prev, services: updated }));
  };

  const handleToggleCategoryAll = (cat) => {
    if (!cat?.services || cat.services.length === 0) return;
    const catSvcIds = new Set(cat.services.map((s) => s.id));
    const allSelected = cat.services.every((s) => formData.services.some((sel) => sel.id === s.id));

    let updated;
    if (allSelected) {
      // Deselect all services in this category
      updated = formData.services.filter((s) => !catSvcIds.has(s.id));
    } else {
      // Select all services in this category
      const otherServices = formData.services.filter((s) => !catSvcIds.has(s.id));
      const newCatServices = cat.services.map((svc) => ({
        id: svc.id,
        name: svc.name,
        category: cat.name || svc.category_name || '',
      }));
      updated = [...otherServices, ...newCatServices];
    }
    setFormData((prev) => ({ ...prev, services: updated }));
  };

  const handleToggleAllServices = () => {
    const allServices = (catalog || []).flatMap((cat) =>
      (cat.services || []).map((s) => ({
        id: s.id,
        name: s.name,
        category: cat.name || '',
      }))
    );
    const isAllGlobalSelected =
      allServices.length > 0 &&
      allServices.every((s) => formData.services.some((sel) => sel.id === s.id));

    if (isAllGlobalSelected) {
      setFormData((prev) => ({ ...prev, services: [] }));
    } else {
      setFormData((prev) => ({ ...prev, services: allServices }));
    }
  };

  const handleSubmitApplication = async () => {
    if (!formData.declarationAccepted) {
      setError('Please accept the declaration to submit your application.');
      return;
    }

    try {
      setIsSaving(true);
      setError('');
      await saveCurrentDraft(7);
      await apiSubmitOnboarding();
      await refreshProfile();
      navigate('/workforce/onboarding/pending-review');
    } catch (err) {
      setError(err.message || 'Submission failed. Please check all mandatory documents.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <AppShell breadcrumbs={[{ label: 'Registration' }]}>
        <LoadingState message="Loading registration wizard..." />
      </AppShell>
    );
  }

  return (
    <AppShell breadcrumbs={[{ label: 'Registration Wizard' }]}>
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Status Banner when Locked */}
        {isLocked && (
          <div className="bg-white border border-slate-200 rounded p-3.5 shadow-sm flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className={`p-1.5 rounded border ${registrationStatus === 'approved' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-amber-50 border-amber-200 text-amber-600'}`}>
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Employee Registration Status
                  </h2>
                  <StatusBadge status={registrationStatus} />
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {registrationStatus === 'approved'
                    ? 'Your registration application is fully approved. All identity, trade, and bank details are verified and active.'
                    : 'Your registration application is lodged and pending Admin verification.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step Indicator Bar (Desktop & Mobile) */}
        <div className="bg-white border border-slate-200 rounded p-3 shadow-sm">
          <div className="flex items-center justify-between sm:hidden mb-2">
            <span className="font-bold text-slate-800 text-xs">
              Step {currentStep} of 7: {STEPS[currentStep - 1]?.label}
            </span>
            <span className="text-[11px] text-slate-500 font-medium">
              {Math.round((currentStep / 7) * 100)}% Complete
            </span>
          </div>

          <div className="hidden sm:flex items-center justify-between gap-1">
            {STEPS.map((s) => {
              const Icon = s.icon;
              const isDone = s.id < currentStep;
              const isCurrent = s.id === currentStep;

              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    if (isLocked || s.id < currentStep) setCurrentStep(s.id);
                  }}
                  disabled={!isLocked && s.id > currentStep}
                  className={`flex-1 py-1 px-2 border-b-2 flex items-center justify-center gap-1.5 transition-colors ${
                    isCurrent
                      ? 'border-blue-600 text-blue-700 font-bold'
                      : isDone
                      ? 'border-emerald-600 text-emerald-700 font-medium hover:bg-slate-50'
                      : 'border-transparent text-slate-400 opacity-60'
                  }`}
                >

                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isCurrent
                        ? 'bg-blue-600 text-white'
                        : isDone
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {isDone ? '✓' : s.id}
                  </span>
                  <span className="text-[11px] whitespace-nowrap">{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Step Form Card */}
        <div className="bg-white border border-slate-200 rounded p-5 sm:p-6 shadow-sm space-y-4">
          {error && <ErrorState message={error} onDismiss={() => setError('')} />}
          {successMsg && (
            <div className="p-3 rounded border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* ── STEP 1: PERSONAL ── */}
          {currentStep === 1 && (
            <div className="space-y-3 text-xs">
              <div>
                <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-blue-600" />
                  1. Personal Information
                </h2>
                <p className="text-slate-500 text-[11px]">
                  Provide your date of birth, gender, and emergency contact.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Date of Birth <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.personal.dob}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        personal: { ...formData.personal, dob: e.target.value },
                      })
                    }
                    className="w-full p-2"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Gender</label>
                  <select
                    value={formData.personal.gender}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        personal: { ...formData.personal, gender: e.target.value },
                      })
                    }
                    className="w-full p-2"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Emergency Contact Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Priya (Spouse / Parent)"
                    value={formData.personal.emergencyName}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        personal: { ...formData.personal, emergencyName: e.target.value },
                      })
                    }
                    className="w-full p-2"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Emergency Contact Phone
                  </label>
                  <input
                    type="tel"
                    placeholder="9876543211"
                    value={formData.personal.emergencyPhone}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        personal: { ...formData.personal, emergencyPhone: e.target.value },
                      })
                    }
                    className="w-full p-2"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2: ADDRESS & TERRITORY ── */}
          {currentStep === 2 && (
            <div className="space-y-3 text-xs">
              <div>
                <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  2. Residential Address & Travel Territory
                </h2>
                <p className="text-slate-500 text-[11px]">
                  Set your base address and operational radius for job dispatch.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Street Address <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    placeholder="House/Flat No, Street, Landmark"
                    value={formData.address.street}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        address: { ...formData.address, street: e.target.value },
                      })
                    }
                    className="w-full p-2"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      City <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.address.city}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          address: { ...formData.address, city: e.target.value },
                        })
                      }
                      className="w-full p-2"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">State</label>
                    <input
                      type="text"
                      value={formData.address.state}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          address: { ...formData.address, state: e.target.value },
                        })
                      }
                      className="w-full p-2"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Pincode <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="500001"
                      value={formData.address.pincode}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          address: { ...formData.address, pincode: e.target.value },
                        })
                      }
                      className="w-full p-2"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Max Travel Radius: <strong className="text-blue-700">{formData.address.serviceRadius} km</strong>
                  </label>
                  <input
                    type="range"
                    min="5"
                    max="50"
                    step="5"
                    value={formData.address.serviceRadius}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        address: { ...formData.address, serviceRadius: parseInt(e.target.value) },
                      })
                    }
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                    <span>5 km</span>
                    <span>25 km (Standard)</span>
                    <span>50 km</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 3: SERVICES ── */}
          {currentStep === 3 && (
            <div className="space-y-3 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-2.5">
                <div>
                  <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <Wrench className="w-4 h-4 text-blue-600" />
                    3. Select Services You Provide
                  </h2>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Select the services you are qualified to perform ({formData.services.length} selected). Each requested service will be reviewed for Admin authorization.
                  </p>
                </div>
                {catalog && catalog.length > 0 && (
                  <button
                    type="button"
                    onClick={handleToggleAllServices}
                    className="self-start sm:self-auto text-xs font-bold px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors shadow-xs"
                  >
                    {catalog.flatMap((c) => c.services || []).length > 0 &&
                    catalog.flatMap((c) => c.services || []).every((s) => formData.services.some((sel) => sel.id === s.id))
                      ? 'Deselect All Services'
                      : 'Select All Services'}
                  </button>
                )}
              </div>

              <div className="space-y-3 pt-1 max-h-[420px] overflow-y-auto pr-1">
                {catalog && catalog.length > 0 ? (
                  catalog.map((cat) => {
                    const catServices = cat.services || [];
                    const selectedCount = catServices.filter((s) => formData.services.some((sel) => sel.id === s.id)).length;
                    const allCatSelected = catServices.length > 0 && selectedCount === catServices.length;

                    return (
                      <div key={cat.id} className="border border-slate-200 rounded-lg p-3 bg-slate-50/50 shadow-xs">
                        <div className="flex items-center justify-between gap-2 mb-2.5 border-b border-slate-200/80 pb-2">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                              {cat.name} ({catServices.length})
                            </h3>
                            {selectedCount > 0 && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                                {selectedCount}/{catServices.length} Selected
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleToggleCategoryAll(cat)}
                            className={`text-[11px] font-bold px-2.5 py-1 rounded transition-all flex items-center gap-1 border shadow-xs active:scale-95 ${
                              allCatSelected
                                ? 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700'
                                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100 hover:border-slate-400'
                            }`}
                          >
                            <span>{allCatSelected ? '✓ Deselect All' : 'Select All'}</span>
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {catServices.map((svc) => {
                            const isSelected = formData.services.some((s) => s.id === svc.id);
                            return (
                              <label
                                key={svc.id}
                                className={`p-2.5 rounded-lg border text-left flex items-start gap-2.5 cursor-pointer transition-all ${
                                  isSelected
                                    ? 'bg-blue-50/90 border-blue-300 text-blue-900 font-semibold shadow-xs'
                                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleService({ ...svc, category_name: cat.name })}
                                  className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs leading-tight">{svc.name}</p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-slate-500 text-center py-6">Loading service catalog...</p>
                )}
              </div>
            </div>
          )}

          {/* ── STEP 4: SKILLS & TOOLS ── */}
          {currentStep === 4 && (
            <div className="space-y-3 text-xs">
              <div>
                <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-blue-600" />
                  4. Professional Experience & Equipment
                </h2>
                <p className="text-slate-500 text-[11px]">
                  Provide your hands-on trade background and transportation mode.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Years of Experience
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="40"
                    value={formData.skills.experienceYears}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        skills: { ...formData.skills, experienceYears: parseFloat(e.target.value) },
                      })
                    }
                    className="w-full p-2"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Vehicle Type
                  </label>
                  <select
                    value={formData.skills.vehicleType}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        skills: { ...formData.skills, vehicleType: e.target.value },
                      })
                    }
                    className="w-full p-2"
                  >
                    <option value="two_wheeler">Two Wheeler (Motorcycle/Scooter)</option>
                    <option value="four_wheeler">Four Wheeler / Van</option>
                    <option value="bicycle">Bicycle</option>
                    <option value="public_transit">Public Transit</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Driving License Number (If applicable)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. DL-0420110012345"
                    value={formData.skills.licenseNumber}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        skills: { ...formData.skills, licenseNumber: e.target.value },
                      })
                    }
                    className="w-full p-2"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 5: DOCUMENTS ── */}
          {currentStep === 5 && (
            <div className="space-y-3 text-xs">
              <div>
                <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-blue-600" />
                  5. Required Verification Documents
                </h2>
                <p className="text-slate-500 text-[11px]">
                  Upload official identification files and trade certificates for compliance auditing.
                </p>
              </div>

              <div className="space-y-2.5 pt-2">
                {[
                  { key: 'aadhaar', title: 'Aadhaar / National ID Card', required: true },
                  { key: 'address_proof', title: 'Address Proof (Electricity Bill / Rent Agreement)', required: true },
                  { key: 'trade_cert', title: 'Trade / Vocational Certificate', required: false },
                  { key: 'bank_proof', title: 'Bank Proof (Cancelled Cheque / Passbook)', required: true },
                ].map((doc) => {
                  const uploaded = formData.documents[doc.key];
                  return (
                    <div
                      key={doc.key}
                      className="p-3 bg-slate-50 border border-slate-200 rounded flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-800">{doc.title}</span>
                          {doc.required && <span className="text-rose-500 font-bold text-[10px]">*Required</span>}
                        </div>
                        {uploaded ? (
                          <p className="text-[11px] text-emerald-700 font-semibold mt-0.5 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Uploaded ({uploaded.status || 'Pending Verification'})</span>
                          </p>
                        ) : (
                          <p className="text-[11px] text-slate-400 mt-0.5">No file uploaded yet</p>
                        )}
                      </div>

                      <div>
                        <label className="cursor-pointer px-2.5 py-1 rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-semibold text-xs inline-flex items-center gap-1 transition-colors">
                          <Upload className="w-3.5 h-3.5 text-blue-600" />
                          <span>{uploaded ? 'Replace' : 'Upload'}</span>
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                handleFileUpload(doc.key, e.target.files[0], doc.title);
                              }
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── STEP 6: BANK DETAILS ── */}
          {currentStep === 6 && (
            <div className="space-y-3 text-xs">
              <div>
                <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-blue-600" />
                  6. Direct Deposit & Bank Information
                </h2>
                <p className="text-slate-500 text-[11px]">
                  Account credentials for weekly service payouts and bonus disbursements.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Account Holder Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="As printed on bank passbook"
                    value={formData.bank.accountHolder}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        bank: { ...formData.bank, accountHolder: e.target.value },
                      })
                    }
                    className="w-full p-2"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    IFSC / Routing Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. SBIN0001234"
                    value={formData.bank.ifsc}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        bank: { ...formData.bank, ifsc: e.target.value.toUpperCase() },
                      })
                    }
                    className="w-full p-2 uppercase"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Account Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••••••"
                    value={formData.bank.accountNumber}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        bank: { ...formData.bank, accountNumber: e.target.value },
                      })
                    }
                    className="w-full p-2"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Confirm Account Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Re-enter account number"
                    value={formData.bank.confirmAccountNumber}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        bank: { ...formData.bank, confirmAccountNumber: e.target.value },
                      })
                    }
                    className="w-full p-2"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 7: REVIEW & SUBMIT ── */}
          {currentStep === 7 && (
            <div className="space-y-4 text-xs">
              <div>
                <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  7. Review & Submit Application
                </h2>
                <p className="text-slate-500 text-[11px]">
                  Confirm your application details before lodging with the Workforce Verification desk.
                </p>
              </div>

              <div className="border border-slate-200 rounded p-4 bg-slate-50/50 space-y-2">
                <div className="flex justify-between border-b border-slate-200 pb-1">
                  <span className="text-slate-500">City / Territory:</span>
                  <span className="font-bold text-slate-800">{formData.address.city} ({formData.address.serviceRadius} km)</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-1">
                  <span className="text-slate-500">Requested Services ({formData.services.length}):</span>
                  <span className="font-bold text-slate-800 text-right truncate max-w-xs">
                    {formData.services.map((s) => s.name).join(', ') || 'None selected'}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-1">
                  <span className="text-slate-500">Experience:</span>
                  <span className="font-bold text-slate-800">{formData.skills.experienceYears} Years</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Documents Uploaded:</span>
                  <span className="font-bold text-blue-700">{Object.keys(formData.documents).length} Files</span>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.declarationAccepted}
                    onChange={(e) => setFormData({ ...formData, declarationAccepted: e.target.checked })}
                    className="mt-0.5 rounded border-slate-300 text-blue-600"
                  />
                  <span className="text-[11px] text-slate-700 leading-relaxed">
                    I declare that the information and documents provided are accurate and genuine. I acknowledge that I will only receive job dispatches after formal Admin verification.
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Stepper Footer Controls */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={handleBack}
                disabled={isSaving}
                className="px-3.5 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            ) : (
              <div />
            )}

            {currentStep < 7 ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={isSaving}
                className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <span>{isSaving ? 'Saving...' : 'Save & Continue'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmitApplication}
                disabled={isSaving || !formData.declarationAccepted}
                className="px-5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {isSaving ? 'Submitting...' : 'Submit Application'}
                <CheckCircle2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default OnboardingWizardPage;
