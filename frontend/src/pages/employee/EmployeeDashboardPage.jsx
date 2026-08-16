import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthProvider.jsx';
import {
  apiGetWorkforceJobs,
  apiTransitionJob,
  apiGetOnboardingProfile,
  apiUploadJobProof,
  apiCollectJobCash,
  apiVerifyPaymentOTP,
  apiGetJobPayment,
  apiRequestWorkExtension,
  apiCustomerDecideExtension,
  apiProgressExtension,
  apiRequestPartsPurchase,
  apiTimeTrackingAction,
  apiGetTimeTracking,
  apiApplyLeave,
  apiGetMySchedule,
  apiGetLeaves,
  apiGetMyPayslips,
  apiGetComplianceRecords,
  apiGetMySkills,
  apiAcceptJobOffer,
  apiRejectJobOffer,
  apiVerifyOTP,
  apiResendOTP,
  apiUploadPreServicePhoto,
  apiGetPreServiceStatus,
  apiGetCatalog,
  apiRequestService,
  apiRemoveService,
  apiVerifyArrival,
} from '../../api/workforceService.js';
import { apiClockIn } from '../../api/clockInApi.js';
import { ClockInCard } from '../../components/employee/ClockInCard.jsx';
import { JobTrackingMap } from '../../components/employee/JobTrackingMap.jsx';

import { AppShell } from '../../components/common/AppShell.jsx';
import { StatusBadge } from '../../components/enterprise/StatusBadge.jsx';
import { Modal } from '../../components/enterprise/Modal.jsx';
import { ErrorState } from '../../components/enterprise/ErrorState.jsx';
import { LiveCameraCaptureModal } from '../../components/common/LiveCameraCaptureModal.jsx';
import { useLocationTracker, getGPSPosition } from '../../hooks/useGPSPosition.js';
import { apiUpdateLocationFull } from '../../api/workforceService.js';
import {
  Wrench,
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Truck,
  Play,
  DollarSign,
  User,
  Phone,
  ShieldCheck,
  Calendar,
  Camera,
  Upload,
  PlusCircle,
  ShoppingBag,
  Sun,
  Moon,
  Send,
  CreditCard,
  Award,
  FileText,
  Settings as SettingsIcon,
  Sparkles,
  Compass,
  Briefcase,
  RefreshCw,
} from 'lucide-react';

export function EmployeeDashboardPage() {
  const { user, employee, togglePresence } = useAuth();
  const location = useLocation();
  const pathname = location.pathname;
  const hash = location.hash;

  const [jobs, setJobs] = useState([]);
  const [allJobs, setAllJobs] = useState([]);
  const [jobQueueTab, setJobQueueTab] = useState('active'); // 'active' | 'completed' | 'all'
  const [profile, setProfile] = useState(null);
  const [timeTracking, setTimeTracking] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [payslips, setPayslips] = useState([]);
  const [complianceRecords, setComplianceRecords] = useState([]);
  const [skills, setSkills] = useState([]);

  // Decline Offer Modal State
  const [declineModalJob, setDeclineModalJob] = useState(null);
  const [selectedDeclineReason, setSelectedDeclineReason] = useState('Too far');
  const [customDeclineReason, setCustomDeclineReason] = useState('');
  const [isDecliningOffer, setIsDecliningOffer] = useState(false);

  const incomingOffers = allJobs.filter(
    (j) => j.active_offer?.status === 'OFFERED' && !j.active_offer?.is_expired
  );
  const activeJobs = allJobs.filter(
    (j) => !['completed', 'cancelled'].includes((j.status || '').toLowerCase()) && j.active_offer?.status !== 'OFFERED'
  );
  const completedJobs = allJobs.filter((j) => (j.status || '').toLowerCase() === 'completed');
  const displayedJobs = jobQueueTab === 'completed' ? completedJobs : (jobQueueTab === 'all' ? allJobs : activeJobs);

  const isOnline = Boolean(user?.isOnline || employee?.is_online);
  const isClockedIn = Boolean(timeTracking?.is_clocked_in);
  const isBreak = timeTracking?.shift_status === 'on_break';

  const [currentLocation, setCurrentLocation] = useState(
    user?.last_known_location || employee?.user?.last_known_location || null
  );
  const [gpsErrorState, setGpsErrorState] = useState(null);

  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Auto-dismiss error and success notification banners after 4.5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 4500);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(''), 4500);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  // Selected job for detailed inspection workspace
  const [selectedJob, setSelectedJob] = useState(null);

  // Phase 2 Pre-Service Verification state
  const [preServiceState, setPreServiceState] = useState({
    geofence_passed: false,
    otp_verified: false,
    presence_photo: false,
    appliance_photo: false,
    work_area_photo: false,
    is_complete: false,
  });
  const [otpInput, setOtpInput] = useState('');

  // ── Live GPS Tracking ────────────────────────────────────────────────────────
  // Single continuous browser GPS watcher managed via useLocationTracker.
  // Pushes real browser GPS to /workforce/presence/location/ (User.last_known_location).
  // Stable ref so handleGPSPosition can read selectedJob without being re-created on every job change
  const selectedJobRef = useRef(null);
  // loadDashboard ref so GPS callback can call it without stale closure
  const loadDashboardRef = useRef(null);

  const handleGPSPosition = useCallback(
    async ({ latitude, longitude, accuracy, speed, heading, captured_at }) => {
      setGpsErrorState(null);
      const newLoc = {
        latitude,
        longitude,
        accuracy,
        speed,
        heading,
        captured_at,
        updated_at: new Date().toISOString(),
      };
      setCurrentLocation(newLoc);
      try {
        const res = await apiUpdateLocationFull(latitude, longitude, accuracy, speed, heading, captured_at);
        // Check if automatic arrival was triggered by this GPS fix
        const currentJob = selectedJobRef.current;
        if (res?.arrived_events?.length > 0 && currentJob) {
          const thisArrived = res.arrived_events.find((e) => e.job_id === currentJob.id);
          if (thisArrived) {
            setPreServiceState((prev) => ({ ...prev, geofence_passed: true }));
            setSelectedJob((prev) => (prev ? { ...prev, status: 'arrived' } : prev));
            setSuccessMsg('Arrival Verified Automatically! Customer Work Start OTP is ready.');
            if (loadDashboardRef.current) loadDashboardRef.current();
          }
        }
      } catch (_) {
        // Silent — GPS update failure should not disrupt the employee dashboard UI
      }
    },
    // Stable empty deps — reads selectedJob via ref to avoid GPS watcher churn
    [],
  );

  const handleGPSError = useCallback((err) => {
    setGpsErrorState(err);
  }, []);

  useLocationTracker(isOnline, handleGPSPosition, handleGPSError);
  // ────────────────────────────────────────────────────────────────────────────────

  // Payment & Cash Collection State
  const [cashModalJob, setCashModalJob] = useState(null);
  const [cashAmountReceived, setCashAmountReceived] = useState('');
  const [isCollectingCash, setIsCollectingCash] = useState(false);
  const [paymentOtpInput, setPaymentOtpInput] = useState('');
  const [isVerifyingPaymentOtp, setIsVerifyingPaymentOtp] = useState(false);

  // Fetch pre-service status once on job selection
  useEffect(() => {
    if (selectedJob?.id) {
      apiGetPreServiceStatus(selectedJob.id)
        .then((res) => setPreServiceState(res))
        .catch(() => {});
    }
  }, [selectedJob?.id]);

  // Poll pre-service status every 4s while job is active and arrival not yet confirmed
  useEffect(() => {
    const activeStatuses = ['accepted', 'on_the_way', 'arrived'];
    if (
      !selectedJob?.id ||
      !activeStatuses.includes((selectedJob.status || '').toLowerCase()) ||
      preServiceState.geofence_passed
    ) {
      return;
    }
    const interval = setInterval(async () => {
      try {
        const res = await apiGetPreServiceStatus(selectedJob.id);
        if (res?.geofence_passed) {
          setPreServiceState(res);
          setSelectedJob((prev) => (prev ? { ...prev, status: 'arrived' } : prev));
        }
      } catch (_) {}
    }, 4000);
    return () => clearInterval(interval);
  }, [selectedJob?.id, selectedJob?.status, preServiceState.geofence_passed]);

  const handleVerifyOtpSubmit = async () => {
    if (!selectedJob || !otpInput.trim()) return;
    try {
      setActionLoading(selectedJob.id);
      const res = await apiVerifyOTP(selectedJob.id, otpInput.trim());
      setSuccessMsg(res.message || 'Customer OTP verified!');
      setPreServiceState((prev) => ({ ...prev, otp_verified: true, is_complete: res.is_complete }));
      await loadDashboard();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.message || 'Invalid Customer OTP code.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResendOtp = async () => {
    if (!selectedJob) return;
    try {
      setActionLoading(selectedJob.id);
      const res = await apiResendOTP(selectedJob.id);
      setSuccessMsg(res.message || 'Fresh OTP generated and sent to customer!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.message || 'Failed to resend OTP.');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePhotoUploadSubmit = async (photoType, file) => {
    if (!selectedJob || !file) return;
    try {
      setActionLoading(selectedJob.id);
      const res = await apiUploadPreServicePhoto(selectedJob.id, photoType, file);
      setSuccessMsg(res.message || 'Photo uploaded!');
      setPreServiceState((prev) => ({
        ...prev,
        [`${photoType}_photo`]: true,
        is_complete: res.is_complete,
      }));
      await loadDashboard();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.message || 'Photo upload failed.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDirectJobClockIn = async () => {
    if (!selectedJob) return;
    setActionLoading(selectedJob.id);
    setError('');
    try {
      const pos = await getGPSPosition(true);
      const lat = pos?.coords?.latitude ?? pos?.latitude;
      const lon = pos?.coords?.longitude ?? pos?.longitude;
      const accuracy = pos?.coords?.accuracy ?? pos?.accuracy;
      if (lat == null || lon == null) throw new Error('Unable to retrieve GPS coordinates for clock-in.');
      const res = await apiClockIn({
        lat,
        lon,
        accuracy,
        timestamp: pos?.timestamp || Date.now(),
        address: selectedJob.address || 'GPS Verified Customer Location',
      });
      setSuccessMsg(res.message || 'Clocked in successfully! Job is now IN PROGRESS.');
      await loadDashboard();
      setSelectedJob((prev) => (prev ? { ...prev, status: 'in_progress' } : null));
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.message || 'Clock-in failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleManualVerifyArrival = async () => {
    if (!selectedJob?.id) return;
    try {
      setActionLoading(selectedJob.id);
      setError('');
      const pos = await getGPSPosition(true);
      const lat = pos?.coords?.latitude ?? pos?.latitude;
      const lon = pos?.coords?.longitude ?? pos?.longitude;
      if (lat == null || lon == null) throw new Error('Unable to retrieve GPS coordinates.');
      const res = await apiVerifyArrival(selectedJob.id, lat, lon);
      setSuccessMsg(res.message || 'Arrival verified! Work Start OTP generated for customer.');
      setPreServiceState((prev) => ({ ...prev, geofence_passed: true }));
      setSelectedJob((prev) => (prev ? { ...prev, status: 'arrived' } : prev));
      await loadDashboard();
    } catch (err) {
      setError(err.message || 'Failed to verify arrival. Ensure you are within 300m of the job site.');
    } finally {
      setActionLoading(null);
    }
  };

  // Modals

  const [proofModalJob, setProofModalJob] = useState(null);
  const [beforeFile, setBeforeFile] = useState(null);
  const [afterFile, setAfterFile] = useState(null);
  const [beforePreviewUrl, setBeforePreviewUrl] = useState(null);
  const [afterPreviewUrl, setAfterPreviewUrl] = useState(null);
  const [workNotes, setWorkNotes] = useState('');
  const [isUploadingProof, setIsUploadingProof] = useState(false);

  // Live Camera Real-Time Capture State
  const [cameraModalConfig, setCameraModalConfig] = useState({
    isOpen: false,
    title: 'Live Camera Photo Capture',
    defaultFacingMode: 'environment',
    fileNamePrefix: 'photo',
    onCapture: null,
  });

  const openLiveCamera = (title, defaultFacingMode, fileNamePrefix, onCaptureCallback) => {
    setCameraModalConfig({
      isOpen: true,
      title,
      defaultFacingMode,
      fileNamePrefix,
      onCapture: onCaptureCallback,
    });
  };

  const closeLiveCamera = () => {
    setCameraModalConfig((prev) => ({ ...prev, isOpen: false, onCapture: null }));
  };

  const [extensionModalJob, setExtensionModalJob] = useState(null);
  const [extTitle, setExtTitle] = useState('');
  const [extLaborCost, setExtLaborCost] = useState('');
  const [extMaterialsCost, setExtMaterialsCost] = useState('');
  const [extReason, setExtReason] = useState('');
  const [extIsCritical, setExtIsCritical] = useState(false);
  const [extRequiresSpecialist, setExtRequiresSpecialist] = useState(false);
  const [isSubmittingExt, setIsSubmittingExt] = useState(false);

  const [partsModalJob, setPartsModalJob] = useState(null);
  const [partName, setPartName] = useState('');
  const [partCost, setPartCost] = useState('');
  const [partVendor, setPartVendor] = useState('');
  const [isSubmittingPart, setIsSubmittingPart] = useState(false);

  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveType, setLeaveType] = useState('Casual Leave');
  const [leaveStart, setLeaveStart] = useState('');
  const [leaveEnd, setLeaveEnd] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [isSubmittingLeave, setIsSubmittingLeave] = useState(false);

  const [catalogCategories, setCatalogCategories] = useState([]);
  const [serviceActionLoading, setServiceActionLoading] = useState(null);

  const loadDashboard = async () => {
    try {
      setIsLoading(true);
      const [jobsData, timeData, profileData] = await Promise.all([
        apiGetWorkforceJobs('all').catch(() => []),
        apiGetTimeTracking().catch(() => null),
        apiGetOnboardingProfile().catch(() => null),
      ]);
      const safeJobs = jobsData || [];
      setAllJobs(safeJobs);
      setJobs(safeJobs);
      setProfile(profileData || employee);
      setTimeTracking(timeData);

      const active = safeJobs.filter((j) => !['completed', 'cancelled'].includes((j.status || '').toLowerCase()));
      const completed = safeJobs.filter((j) => (j.status || '').toLowerCase() === 'completed');

      if (jobQueueTab === 'completed') {
        if (completed.length > 0) {
          setSelectedJob((prev) => (prev ? completed.find((j) => j.id === prev.id) || completed[0] : completed[0]));
        } else {
          setSelectedJob(null);
        }
      } else if (jobQueueTab === 'active') {
        if (active.length > 0) {
          setSelectedJob((prev) => (prev ? active.find((j) => j.id === prev.id) || active[0] : active[0]));
        } else {
          setSelectedJob(null);
        }
      } else {
        if (safeJobs.length > 0) {
          setSelectedJob((prev) => (prev ? safeJobs.find((j) => j.id === prev.id) || safeJobs[0] : safeJobs[0]));
        } else {
          setSelectedJob(null);
        }
      }
    } catch (_) {
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [jobQueueTab]);

  // Keep refs in sync so GPS callback can read fresh values without recreating the callback
  useEffect(() => {
    selectedJobRef.current = selectedJob;
  }, [selectedJob]);

  useEffect(() => {
    loadDashboardRef.current = loadDashboard;
  });

  // Request browser notification permission when employee is online
  useEffect(() => {
    if (isOnline && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, [isOnline]);

  // Listen for real-time location update events (from TopHeader or ClockInCard) to refresh job queue
  useEffect(() => {
    const handleLocationUpdate = () => {
      loadDashboard();
    };
    window.addEventListener('workforce:location-updated', handleLocationUpdate);
    return () => window.removeEventListener('workforce:location-updated', handleLocationUpdate);
  }, []);

  // Realtime Event Stream Integration (SSE): instantaneous job offer delivery
  useEffect(() => {
    if (!isOnline) return;
    let eventSource = null;
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('access_token') || sessionStorage.getItem('token') || '';
      const streamUrl = token ? `/api/workforce/realtime/stream/?token=${encodeURIComponent(token)}` : '/api/workforce/realtime/stream/';
      eventSource = new EventSource(streamUrl);
      eventSource.addEventListener('workforce_event', (e) => {
        try {
          const data = JSON.parse(e.data);
          if (['OFFER_CREATED', 'JOB_OFFER', 'JOB_ASSIGNED', 'ARRIVAL_DETECTED'].includes(data.event_type)) {
            loadDashboard();
          }
        } catch (_) {}
      });
      eventSource.onerror = () => {
        if (eventSource) eventSource.close();
      };
    } catch (_) {}

    return () => {
      if (eventSource) eventSource.close();
    };
  }, [isOnline, loadDashboard]);

  // Silent background job queue safety-net polling when technician is ONLINE (12s interval)
  useEffect(() => {
    if (!isOnline) return;
    const interval = setInterval(async () => {
      try {
        const jobsData = await apiGetWorkforceJobs('all').catch(() => null);
        if (jobsData) {
          setAllJobs(jobsData);
          setJobs(jobsData);
          const active = jobsData.filter(
            (j) => !['completed', 'cancelled'].includes((j.status || '').toLowerCase()) && j.active_offer?.status !== 'OFFERED'
          );
          const completed = jobsData.filter((j) => (j.status || '').toLowerCase() === 'completed');

          if (jobQueueTab === 'active') {
            if (active.length === 0) setSelectedJob(null);
            else setSelectedJob((prev) => (prev ? active.find((j) => j.id === prev.id) || active[0] : active[0]));
          } else if (jobQueueTab === 'completed') {
            if (completed.length === 0) setSelectedJob(null);
            else setSelectedJob((prev) => (prev ? completed.find((j) => j.id === prev.id) || completed[0] : completed[0]));
          }

          // If a new offer is available, auto-focus it in the workspace
          const offeredJob = jobsData.find((j) => j.active_offer?.status === 'OFFERED' || j.offer_status === 'OFFERED');
          if (offeredJob) {
            setSelectedJob((prev) => (!prev || (prev.active_offer?.status !== 'OFFERED' && prev.offer_status !== 'OFFERED') ? offeredJob : prev));
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              try {
                new Notification('⚡ New Exclusive Job Offer!', {
                  body: `Job #${offeredJob.request_id || offeredJob.id}: ${offeredJob.service_title || offeredJob.service_category}. Accept within 5 minutes.`,
                  icon: '/favicon.ico',
                });
              } catch (_) {}
            }
          }
        }
      } catch (_) {}
    }, 10000);
    return () => clearInterval(interval);
  }, [isOnline, jobQueueTab]);



  // Fetch module specific data depending on active path
  useEffect(() => {
    if (pathname.includes('/schedule')) {
      apiGetMySchedule().then(setSchedules).catch(() => setSchedules([]));
    } else if (pathname.includes('/earnings')) {
      apiGetMyPayslips().then(setPayslips).catch(() => setPayslips([]));
    } else if (pathname.includes('/documents')) {
      apiGetComplianceRecords().then(setComplianceRecords).catch(() => setComplianceRecords([]));
    } else if (pathname.includes('/services')) {
      apiGetMySkills().then(setSkills).catch(() => setSkills([]));
      apiGetCatalog().then(setCatalogCategories).catch(() => setCatalogCategories([]));
      apiGetOnboardingProfile().then(setProfile).catch(() => {});
    } else if (pathname.includes('/leave') || hash === '#leave') {
      apiGetLeaves().then(setLeaves).catch(() => setLeaves([]));
    }
  }, [pathname, hash]);

  const handleRequestService = async (serviceId, name) => {
    try {
      setServiceActionLoading(serviceId);
      setError('');
      await apiRequestService(serviceId, name);
      setSuccessMsg(`Service authorization request for "${name}" submitted for Admin review.`);
      const updatedProfile = await apiGetOnboardingProfile().catch(() => null);
      if (updatedProfile) setProfile(updatedProfile);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.message || 'Failed to submit service authorization request.');
    } finally {
      setServiceActionLoading(null);
    }
  };

  const handleRemoveService = async (serviceId, name) => {
    try {
      setServiceActionLoading(serviceId);
      setError('');
      await apiRemoveService(serviceId);
      setSuccessMsg(`Removal request for "${name}" submitted for Admin review.`);
      const updatedProfile = await apiGetOnboardingProfile().catch(() => null);
      if (updatedProfile) setProfile(updatedProfile);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.message || 'Failed to submit service removal request.');
    } finally {
      setServiceActionLoading(null);
    }
  };


  const handleToggleOnline = async () => {
    try {
      setError('');
      await togglePresence();
      await loadDashboard();
    } catch (err) {
      setError(err.message || 'Failed to toggle availability.');
    }
  };

  const handleJobAction = async (jobId, targetStatus) => {
    try {
      setActionLoading(jobId);
      setError('');
      await apiTransitionJob(jobId, targetStatus);
      await loadDashboard();
    } catch (err) {
      setError(err.message || 'Status transition failed.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleProofSubmit = async (e) => {
    e.preventDefault();
    if (!proofModalJob) return;

    try {
      setIsUploadingProof(true);
      const formData = new FormData();
      if (afterFile) formData.append('after_appliance_photo', afterFile);
      if (beforeFile) formData.append('after_work_area_photo', beforeFile);
      formData.append('notes', workNotes);

      await apiUploadJobProof(proofModalJob.id, formData);
      setProofModalJob(null);
      setBeforeFile(null);
      setAfterFile(null);
      if (beforePreviewUrl) URL.revokeObjectURL(beforePreviewUrl);
      if (afterPreviewUrl) URL.revokeObjectURL(afterPreviewUrl);
      setBeforePreviewUrl(null);
      setAfterPreviewUrl(null);
      setWorkNotes('');
      setSuccessMsg('After-service proof submitted! Job is COMPLETED.');
      await loadDashboard();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.message || 'Proof upload failed.');
    } finally {
      setIsUploadingProof(false);
    }
  };

  const handleCashCollectSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!cashModalJob) return;

    try {
      setIsCollectingCash(true);
      const res = await apiCollectJobCash(cashModalJob.id, parseFloat(cashAmountReceived) || 0);
      setCashModalJob(null);
      setCashAmountReceived('');
      setSuccessMsg(res.message || 'Cash collection recorded! Awaiting customer confirmation.');
      await loadDashboard();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.message || 'Cash collection failed.');
    } finally {
      setIsCollectingCash(false);
    }
  };

  const handleVerifyPaymentOtpSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!selectedJob || !paymentOtpInput.trim()) return;

    try {
      setIsVerifyingPaymentOtp(true);
      const res = await apiVerifyPaymentOTP(selectedJob.id, paymentOtpInput.trim());
      setSuccessMsg(res.message || 'Payment successfully verified via Customer OTP!');
      setPaymentOtpInput('');
      await loadDashboard();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.message || 'Payment OTP verification failed.');
    } finally {
      setIsVerifyingPaymentOtp(false);
    }
  };

  const handleAcceptOffer = async (jobId) => {
    try {
      setActionLoading(jobId);
      await apiAcceptJobOffer(jobId);
      setSuccessMsg('Job offer accepted successfully!');
      await loadDashboard();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.message || 'Failed to accept job offer.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectOffer = (jobId) => {
    const target = allJobs.find((j) => j.id === jobId) || selectedJob;
    setDeclineModalJob(target || { id: jobId });
    setSelectedDeclineReason('Too far');
    setCustomDeclineReason('');
  };

  const handleConfirmDeclineOffer = async (e) => {
    if (e) e.preventDefault();
    if (!declineModalJob) return;
    const finalReason = selectedDeclineReason === 'Other'
      ? (customDeclineReason.trim() || 'Other reason')
      : selectedDeclineReason;

    try {
      setIsDecliningOffer(true);
      setActionLoading(declineModalJob.id);
      await apiRejectJobOffer(declineModalJob.id, finalReason);
      setDeclineModalJob(null);
      setSuccessMsg('Job offer declined.');
      await loadDashboard();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.message || 'Failed to decline job offer.');
    } finally {
      setIsDecliningOffer(false);
      setActionLoading(null);
    }
  };

  const handleExtensionSubmit = async (e) => {
    e.preventDefault();
    if (!extensionModalJob) return;

    try {
      setIsSubmittingExt(true);
      await apiRequestWorkExtension(extensionModalJob.id, {
        title: extTitle.trim() || 'Scope Extension',
        estimated_labor_cost: parseFloat(extLaborCost) || 0,
        estimated_materials_cost: parseFloat(extMaterialsCost) || 0,
        reason: extReason.trim(),
        is_critical: extIsCritical,
        requires_specialist: extRequiresSpecialist,
      });
      setExtensionModalJob(null);
      setExtTitle('');
      setExtLaborCost('');
      setExtMaterialsCost('');
      setExtReason('');
      setExtIsCritical(false);
      setExtRequiresSpecialist(false);
      setSuccessMsg('Work extension request submitted to Admin for review!');
      await loadDashboard();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.message || 'Work extension request failed.');
    } finally {
      setIsSubmittingExt(false);
    }
  };

  const handleCustomerDecideExtensionAction = async (jobId, extId, action) => {
    try {
      setActionLoading(`ext-${extId}`);
      let reason = '';
      if (action === 'DECLINE') {
        reason = prompt('Enter reason for customer decline:') || 'Customer declined additional scope';
      }
      const res = await apiCustomerDecideExtension(jobId, extId, action, reason);
      setSuccessMsg(res.message || 'Customer decision recorded.');
      await loadDashboard();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.message || 'Failed to record customer decision.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleProgressExtensionAction = async (jobId, extId, action) => {
    try {
      setActionLoading(`ext-${extId}`);
      const res = await apiProgressExtension(jobId, extId, action);
      setSuccessMsg(res.message || 'Extension status updated.');
      await loadDashboard();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.message || 'Failed to update extension progress.');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePartsSubmit = async (e) => {
    e.preventDefault();
    if (!partsModalJob) return;

    try {
      setIsSubmittingPart(true);
      await apiRequestPartsPurchase(partsModalJob.id, {
        part_name: partName,
        estimated_cost: parseFloat(partCost) || 0,
        vendor_name: partVendor,
      });
      setPartsModalJob(null);
      setPartName('');
      setPartCost('');
      setPartVendor('');
      setSuccessMsg('Parts purchase request submitted!');
      await loadDashboard();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.message || 'Parts purchase request failed.');
    } finally {
      setIsSubmittingPart(false);
    }
  };

  const handleApplyLeaveSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsSubmittingLeave(true);
      await apiApplyLeave({
        leave_type: leaveType,
        start_date: leaveStart,
        end_date: leaveEnd,
        reason: leaveReason,
      });
      setShowLeaveModal(false);
      setLeaveStart('');
      setLeaveEnd('');
      setLeaveReason('');
      setSuccessMsg('Leave application submitted for Admin approval.');
      const updated = await apiGetLeaves().catch(() => []);
      setLeaves(updated);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.message || 'Failed to submit leave application.');
    } finally {
      setIsSubmittingLeave(false);
    }
  };

  const allRequestedServices = profile?.all_requested_services || (profile?.bank_details?.onboarding?.services) || [];
  const approvedServices = allRequestedServices.filter((s) => s.status === 'approved');

  return (
    <AppShell breadcrumbs={[{ label: 'Home' }, { label: 'Technician Hub' }]}>
      <div className="space-y-4">
        {/* Availability & Shift Status Bar */}
        <div className="bg-white border border-slate-200 rounded p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-800 text-sm">
              {user?.firstName ? user.firstName[0].toUpperCase() : 'T'}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base font-bold text-slate-900">
                  {user?.firstName ? `${user.firstName} ${user.lastName}` : user?.username}
                </h1>
                <StatusBadge
                  status={isOnline ? 'online' : 'offline'}
                  label={isOnline ? 'AVAILABLE' : 'OFFLINE'}
                />
                {isClockedIn && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    {isBreak ? 'ON BREAK' : 'SHIFT ACTIVE'}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                ID: <strong className="text-slate-800">{profile?.employee_id || user?.username}</strong>
                {profile?.city ? ` • Territory: ${profile.city}` : ''}
              </p>
            </div>
          </div>

          {/* Controls: Go Online / Go Offline */}
          <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
            <button
              type="button"
              onClick={handleToggleOnline}
              className={`px-3.5 py-1.5 rounded text-xs font-bold transition-colors shadow-sm ${
                isOnline
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {isOnline ? 'GO OFFLINE' : 'GO ONLINE'}
            </button>

            <button
              type="button"
              onClick={() => setShowLeaveModal(true)}
              className="px-2.5 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors inline-flex items-center gap-1"
            >
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>Apply Leave</span>
            </button>
          </div>
        </div>

        {/* Geofenced Clock-In & Shift Attendance Card: Render ONLY on Main Dashboard */}
        {!pathname.includes('/schedule') &&
          !pathname.includes('/attendance') &&
          !pathname.includes('/leave') &&
          !hash.includes('#attendance') &&
          !hash.includes('#leave') &&
          !pathname.includes('/earnings') &&
          !pathname.includes('/documents') &&
          !pathname.includes('/services') &&
          !pathname.includes('/settings') && (
            <ClockInCard
              onStatusChange={loadDashboard}
              activeJob={jobs.find((j) => ['accepted', 'on_the_way', 'arrived', 'in_progress'].includes((j.status || '').toLowerCase()))}
              hasActiveJob={jobs.some((j) => ['accepted', 'on_the_way', 'arrived', 'in_progress'].includes((j.status || '').toLowerCase()))}
              isOnline={isOnline}
              currentLocation={currentLocation}
              onLocationUpdate={handleGPSPosition}
              gpsError={gpsErrorState}
            />
          )}

        {/* Notifications */}
        {error && <ErrorState message={error} onDismiss={() => setError('')} />}
        {successMsg && (
          <div className="p-3 rounded border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ── ROUTE SPECIFIC VIEWS ── */}

        {/* 1. SCHEDULE TAB */}
        {pathname.includes('/schedule') && (
          <div className="bg-white border border-slate-200 rounded overflow-hidden shadow-sm">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                Work Schedule & Shift Timings
              </h2>
            </div>
            <div className="p-4">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5">Day of Week</th>
                    <th className="px-4 py-2.5">Working Day</th>
                    <th className="px-4 py-2.5">Start Time</th>
                    <th className="px-4 py-2.5">End Time</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, idx) => {
                    const sch = schedules.find((s) => s.day_of_week === idx);
                    const isWorkDay = sch ? sch.is_working_day : idx < 5;
                    return (
                      <tr key={day} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-semibold text-slate-800">{day}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isWorkDay ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'}`}>
                            {isWorkDay ? 'WORK DAY' : 'OFF DAY'}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-700">{sch?.start_time || '09:00:00'}</td>
                        <td className="px-4 py-3 font-mono text-slate-700">{sch?.end_time || '18:00:00'}</td>
                        <td className="px-4 py-3 text-slate-500">Active Schedule</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 2. ATTENDANCE TAB */}
        {(pathname.includes('/attendance') || hash === '#attendance') && (
          <div className="bg-white border border-slate-200 rounded overflow-hidden shadow-sm">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                Shift Attendance & Action Logs
              </h2>
            </div>
            <div className="p-4">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5">Log ID</th>
                    <th className="px-4 py-2.5">Timestamp</th>
                    <th className="px-4 py-2.5">Action Executed</th>
                    <th className="px-4 py-2.5">Shift Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {timeTracking?.logs && timeTracking.logs.length > 0 ? (
                    timeTracking.logs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono text-slate-500">#{log.id}</td>
                        <td className="px-4 py-3 text-slate-800">{new Date(log.timestamp).toLocaleString()}</td>
                        <td className="px-4 py-3 font-semibold text-blue-700 capitalize">{log.action.replace('_', ' ')}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={log.shift_status} size="xs" />
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                        No shift attendance logs recorded for today.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. LEAVE TAB */}
        {(pathname.includes('/leave') || hash === '#leave') && (
          <div className="bg-white border border-slate-200 rounded overflow-hidden shadow-sm">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                My Leaves & Absence Applications ({leaves.length})
              </h2>
              <button
                type="button"
                onClick={() => setShowLeaveModal(true)}
                className="px-3 py-1 bg-blue-600 text-white font-bold rounded text-xs hover:bg-blue-700"
              >
                + New Application
              </button>
            </div>
            <div className="p-4">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5">Leave Type</th>
                    <th className="px-4 py-2.5">Start Date</th>
                    <th className="px-4 py-2.5">End Date</th>
                    <th className="px-4 py-2.5">Reason</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leaves.length > 0 ? (
                    leaves.map((l, idx) => (
                      <tr key={l.id ? `leave-${l.id}` : `leave-idx-${idx}`} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-semibold text-slate-800">{l.leave_type}</td>
                        <td className="px-4 py-3 text-slate-700">{l.start_date}</td>
                        <td className="px-4 py-3 text-slate-700">{l.end_date}</td>
                        <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{l.reason}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={l.status} size="xs" />
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                        No leave applications submitted.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. EARNINGS TAB */}
        {pathname.includes('/earnings') && (
          <div className="bg-white border border-slate-200 rounded overflow-hidden shadow-sm">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                Earnings & Issued Payslips ({payslips.length})
              </h2>
            </div>
            <div className="p-4">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5">Pay Period</th>
                    <th className="px-4 py-2.5">Base Earnings</th>
                    <th className="px-4 py-2.5">Job Share</th>
                    <th className="px-4 py-2.5">Net Pay</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payslips.length > 0 ? (
                    payslips.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-semibold text-slate-800">{p.pay_period_name || `Period #${p.pay_period}`}</td>
                        <td className="px-4 py-3 font-mono text-slate-700">₹{p.base_earnings}</td>
                        <td className="px-4 py-3 font-mono text-slate-700">₹{p.job_earnings}</td>
                        <td className="px-4 py-3 font-mono font-bold text-emerald-700">₹{p.net_pay}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={p.status} size="xs" />
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                        No issued payslips found for current billing cycle.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 5. DOCUMENTS TAB */}
        {pathname.includes('/documents') && (
          <div className="bg-white border border-slate-200 rounded overflow-hidden shadow-sm">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                Compliance & Dossier Documents ({complianceRecords.length})
              </h2>
            </div>
            <div className="p-4">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5">Requirement</th>
                    <th className="px-4 py-2.5">Document #</th>
                    <th className="px-4 py-2.5">Expiry Date</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {complianceRecords.length > 0 ? (
                    complianceRecords.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-semibold text-slate-800">{c.requirement_title}</td>
                        <td className="px-4 py-3 font-mono text-slate-700">{c.document_number || '—'}</td>
                        <td className="px-4 py-3 text-slate-700">{c.expiry_date || 'N/A'}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={c.status} size="xs" />
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                        No compliance records required.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 6. SERVICES TAB */}
        {pathname.includes('/services') && (
          <div className="bg-white border border-slate-200 rounded overflow-hidden shadow-sm space-y-4 p-4">
            <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-blue-600" />
                  Employee Service Authorizations & Skills
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Select available services from the company catalog to request operational dispatch authorization.
                </p>
              </div>
            </div>

            {/* 1. Authorized Dispatch Services */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-700 uppercase flex items-center justify-between">
                <span>Authorized Services ({approvedServices.length})</span>
                <span className="text-[10px] text-emerald-700 font-semibold">Eligible for Automatic Dispatch</span>
              </h3>
              {approvedServices.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {approvedServices.map((svc) => (
                    <div key={svc.id} className="p-3 bg-emerald-50/60 border border-emerald-200 rounded flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <div>
                          <p className="font-bold text-slate-800 text-xs">{svc.name}</p>
                          <span className="text-[10px] text-emerald-700 font-semibold uppercase">Authorized ✓</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveService(svc.id, svc.name)}
                        disabled={serviceActionLoading === svc.id}
                        className="text-[10px] font-bold text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-2 py-1 rounded border border-rose-200 transition-colors"
                      >
                        {serviceActionLoading === svc.id ? 'Submitting...' : 'Request Removal'}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded text-slate-500 text-xs">
                  No services approved yet. Browse the catalog below to request service authorization.
                </div>
              )}
            </div>

            {/* 2. Pending Admin Review Requests */}
            {allRequestedServices.filter((s) => s.status === 'pending').length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-amber-800 uppercase flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  Pending Admin Review ({allRequestedServices.filter((s) => s.status === 'pending').length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {allRequestedServices.filter((s) => s.status === 'pending').map((svc) => (
                    <div key={svc.id} className="p-3 bg-amber-50 border border-amber-200 rounded flex items-center justify-between">
                      <div>
                        <p className="font-bold text-slate-800 text-xs">{svc.name}</p>
                        <p className="text-[10px] text-amber-700 font-semibold">
                          {svc.request_type === 'remove' ? 'REMOVAL PENDING REVIEW' : 'AUTHORIZATION PENDING REVIEW'}
                        </p>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                        PENDING
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. Rejected Service Requests */}
            {allRequestedServices.filter((s) => s.status === 'rejected').length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-rose-800 uppercase flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                  Rejected Service Requests ({allRequestedServices.filter((s) => s.status === 'rejected').length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {allRequestedServices.filter((s) => s.status === 'rejected').map((svc) => (
                    <div key={svc.id} className="p-3 bg-rose-50 border border-rose-200 rounded space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-slate-800 text-xs">{svc.name}</p>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                          REJECTED
                        </span>
                      </div>
                      {svc.rejection_reason && (
                        <p className="text-[10px] text-rose-700">
                          <strong>Reason:</strong> {svc.rejection_reason}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRequestService(svc.id, svc.name)}
                        disabled={serviceActionLoading === svc.id}
                        className="text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-0.5 rounded border border-blue-200 transition-colors"
                      >
                        {serviceActionLoading === svc.id ? 'Submitting...' : 'Re-apply for Authorization'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. Available Service Catalog */}
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
                Available Service Catalog
              </h3>
              <div className="space-y-4">
                {catalogCategories.map((cat) => (
                  <div key={cat.id || cat.name} className="border border-slate-200 rounded overflow-hidden">
                    <div className="bg-slate-50 px-3.5 py-2 border-b border-slate-200 font-bold text-xs text-slate-800">
                      {cat.name}
                    </div>
                    <div className="divide-y divide-slate-100">
                      {(cat.services || []).map((s) => {
                        const existing = allRequestedServices.find((req) => String(req.id) === String(s.id));
                        const isApproved = existing?.status === 'approved';
                        const isPending = existing?.status === 'pending';

                        return (
                          <div key={s.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/50">
                            <div>
                              <p className="font-semibold text-slate-900 text-xs">{s.name}</p>
                              <p className="text-[10px] text-slate-500 font-mono">
                                Approx. {s.duration || 60} mins
                              </p>
                            </div>
                            <div>
                              {isApproved ? (
                                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-xs font-bold flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  Authorized
                                </span>
                              ) : isPending ? (
                                <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded text-xs font-bold flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                                  Pending Review
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleRequestService(s.id, s.name)}
                                  disabled={serviceActionLoading === s.id}
                                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded transition-colors shadow-sm disabled:opacity-50"
                                >
                                  {serviceActionLoading === s.id ? 'Submitting...' : 'Request Authorization'}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 5. Verified Skill Ratings */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <h3 className="text-xs font-bold text-slate-700 uppercase">Verified Skill Ratings</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {skills.length > 0 ? (
                  skills.map((sk) => (
                    <div key={sk.id} className="p-3 border border-slate-200 rounded bg-slate-50">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-slate-900 text-xs">{sk.skill_name}</h4>
                        <span className="text-[10px] font-bold uppercase text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          {sk.proficiency_level}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500">No skill certifications assigned yet.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 7. SETTINGS TAB */}
        {pathname.includes('/settings') && (
          <div className="bg-white border border-slate-200 rounded overflow-hidden shadow-sm p-5 space-y-4">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b border-slate-200 pb-2">
              <SettingsIcon className="w-4 h-4 text-slate-600" />
              Technician Preferences & Profile Settings
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-slate-500 font-medium mb-1">Technician Name</label>
                <input type="text" readOnly value={`${user?.firstName || ''} ${user?.lastName || ''}`} className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-slate-800 font-semibold" />
              </div>
              <div>
                <label className="block text-slate-500 font-medium mb-1">Registered Phone</label>
                <input type="text" readOnly value={user?.username || ''} className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-slate-800 font-mono" />
              </div>
            </div>
          </div>
        )}

        {/* 8. DEFAULT: ACTIVE JOBS WORKSPACE */}
        {!pathname.includes('/schedule') &&
          !pathname.includes('/attendance') &&
          !pathname.includes('/leave') &&
          !hash.includes('#attendance') &&
          !hash.includes('#leave') &&
          !pathname.includes('/earnings') &&
          !pathname.includes('/documents') &&
          !pathname.includes('/services') &&
          !pathname.includes('/settings') && (
            <>
              {/* ⚡ Dedicated Incoming Job Offers Section */}
              {incomingOffers.length > 0 && (
                <div className="space-y-2 bg-amber-50 border-2 border-amber-400 rounded p-4 shadow-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                      </span>
                      <h2 className="text-xs font-bold text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-amber-600" />
                        Exclusive Job Offer Available ({incomingOffers.length})
                      </h2>
                    </div>
                    <span className="text-[11px] font-bold text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded">
                      Action Required
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    {incomingOffers.map((offerJob) => {
                      const offer = offerJob.active_offer;
                      return (
                        <div
                          key={offerJob.id}
                          className="bg-white border border-amber-300 rounded p-3.5 shadow-sm space-y-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="font-mono font-bold text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                {offerJob.request_id || `SR-${offerJob.id}`}
                              </span>
                              <h3 className="text-sm font-bold text-slate-900 mt-1">
                                {offerJob.service_title || offerJob.service_category}
                              </h3>
                            </div>
                            {offerJob.distance_km != null && (
                              <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 shrink-0">
                                📍 {offerJob.distance_km.toFixed(1)} km away
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-100 space-y-1">
                            <p className="flex items-center gap-1.5 truncate">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">{offerJob.address || 'Customer site address provided upon acceptance'}</span>
                            </p>
                            {offer?.expires_at && (
                              <p className="flex items-center gap-1.5 text-rose-700 font-semibold text-[11px]">
                                <Clock className="w-3.5 h-3.5 shrink-0" />
                                <span>Expires: {new Date(offer.expires_at).toLocaleTimeString()}</span>
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => handleAcceptOffer(offerJob.id)}
                              disabled={actionLoading === offerJob.id}
                              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-xs shadow-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>{actionLoading === offerJob.id ? 'Accepting...' : 'ACCEPT JOB'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRejectOffer(offerJob.id)}
                              disabled={actionLoading === offerJob.id}
                              className="px-3.5 py-2 bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 font-bold rounded text-xs transition-colors cursor-pointer disabled:opacity-50"
                            >
                              DECLINE
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Authorized Services Strip */}
              <div className="bg-white border border-slate-200 rounded p-3 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-blue-600" />
                    Your Authorized Dispatch Services ({approvedServices.length})
                  </h2>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {approvedServices.length > 0 ? (
                    approvedServices.map((svc) => (
                      <span
                        key={svc.id}
                        className="px-2 py-0.5 bg-slate-50 border border-slate-200 rounded text-[11px] font-medium text-slate-800 inline-flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>{svc.name}</span>
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-500">
                      Awaiting Admin service authorizations.
                    </span>
                  )}
                </div>
              </div>

              {/* Task-Oriented Job Workspace */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Left Column: Assigned Jobs List (5 cols) */}
                <div className="lg:col-span-5 border border-slate-200 bg-white rounded overflow-hidden shadow-sm flex flex-col">
                  <div className="bg-slate-50 px-3.5 py-2.5 border-b border-slate-200 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5 text-blue-600" />
                        Jobs Queue ({displayedJobs.length})
                      </h2>
                      <button
                        type="button"
                        onClick={loadDashboard}
                        className="text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer"
                      >
                        Refresh
                      </button>
                    </div>

                    {/* Filter Tabs: Active / Completed / All */}
                    <div className="flex items-center gap-1 bg-slate-200/70 p-0.5 rounded text-[11px] font-bold">
                      <button
                        type="button"
                        onClick={() => {
                          setJobQueueTab('active');
                          if (activeJobs.length > 0) setSelectedJob(activeJobs[0]);
                          else setSelectedJob(null);
                        }}
                        className={`flex-1 py-1 px-2 rounded text-center transition-all cursor-pointer ${
                          jobQueueTab === 'active'
                            ? 'bg-white text-blue-700 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Active ({activeJobs.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setJobQueueTab('completed');
                          if (completedJobs.length > 0) setSelectedJob(completedJobs[0]);
                          else setSelectedJob(null);
                        }}
                        className={`flex-1 py-1 px-2 rounded text-center transition-all cursor-pointer ${
                          jobQueueTab === 'completed'
                            ? 'bg-white text-emerald-700 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Completed ({completedJobs.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setJobQueueTab('all');
                          if (allJobs.length > 0) setSelectedJob(allJobs[0]);
                        }}
                        className={`py-1 px-2.5 rounded text-center transition-all cursor-pointer ${
                          jobQueueTab === 'all'
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        All ({allJobs.length})
                      </button>
                    </div>
                  </div>

                  <div className="divide-y divide-slate-100 max-h-[550px] overflow-y-auto">
                    {displayedJobs.length > 0 ? (
                      [...displayedJobs].sort((a, b) => (b.id || 0) - (a.id || 0)).map((job) => {
                        const isSelected = selectedJob?.id === job.id;
                        return (
                          <div
                            key={job.id}
                            onClick={() => setSelectedJob(job)}
                            className={`p-3.5 cursor-pointer transition-colors ${
                              isSelected ? 'bg-blue-50/80 border-l-4 border-blue-600' : 'hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[11px] mb-1">
                              <span className="font-mono font-bold text-blue-600">
                                {job.request_id || `SR-${job.id}`}
                              </span>
                              <StatusBadge status={job.status} size="xs" />
                            </div>
                            <h3 className="text-xs font-bold text-slate-900 truncate">
                              {job.service_title || job.service_category}
                            </h3>
                            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-0.5 gap-2">
                              <span className="truncate flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="truncate">{job.address || 'Address provided on acceptance'}</span>
                              </span>
                              {job.distance_km != null && (
                                <span className="shrink-0 font-mono text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                                  {job.distance_km.toFixed(1)} km away
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100 text-[10px] text-slate-500">
                              <span>Date: <strong className="text-slate-800">{job.preferred_date || '—'}</strong></span>
                              <span>{job.preferred_time || ''}</span>
                            </div>

                            {(job.active_offer?.status === 'OFFERED' || job.status === 'job_offered') && (
                              <div className="mt-2.5 p-2.5 rounded bg-amber-50 border border-amber-200 text-amber-900 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-[10px] text-amber-800 uppercase tracking-wider flex items-center gap-1">
                                    <Sparkles className="w-3 h-3 text-amber-600" />
                                    <span>EXCLUSIVE JOB OFFER</span>
                                  </span>
                                  {job.distance_km != null ? (
                                    <span className="text-[10px] font-mono font-bold text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300">
                                      {job.distance_km.toFixed(1)} km away
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-mono text-amber-700">
                                      {job.preferred_time || '5m Expiry'}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 pt-1">
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleAcceptOffer(job.id); }}
                                    disabled={actionLoading === job.id}
                                    className="flex-1 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-[10px] shadow-sm transition-colors"
                                  >
                                    {actionLoading === job.id ? 'ACCEPTING...' : 'ACCEPT'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleRejectOffer(job.id); }}
                                    disabled={actionLoading === job.id}
                                    className="flex-1 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded text-[10px] shadow-sm transition-colors"
                                  >
                                    DECLINE
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-10 text-center text-xs text-slate-500 space-y-1">
                        <p className="font-semibold text-slate-700">
                          {jobQueueTab === 'completed' ? 'No completed jobs yet.' : 'No active jobs in queue.'}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {jobQueueTab === 'completed'
                            ? 'Jobs you finish and submit proof for will appear here.'
                            : (incomingOffers.length > 0
                                ? 'You have incoming job offer(s) above waiting for acceptance.'
                                : (isOnline
                                    ? (currentLocation ? '🟢 Online & Eligible. Standby for customer bookings in your area.' : 'Centralized GPS active. Ensure location permission is allowed.')
                                    : 'Technician is OFFLINE. Switch status to GO ONLINE to receive bookings.'))}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: Selected Job Workspace (7 cols) */}
                <div className="lg:col-span-7 border border-slate-200 bg-white rounded overflow-hidden shadow-sm">
                  {selectedJob ? (
                    <div className="p-4 sm:p-5 space-y-4">
                      {/* Job Header */}
                      <div className="flex items-start justify-between border-b border-slate-200 pb-3 gap-2">
                        <div>
                          <span className="font-mono font-bold text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            {selectedJob.request_id || `Job #${selectedJob.id}`}
                          </span>
                          <h2 className="text-sm font-bold text-slate-900 mt-1">
                            {selectedJob.service_title || selectedJob.service_category}
                          </h2>
                        </div>
                        <div className="text-right">
                          <StatusBadge status={selectedJob.status} />
                        </div>
                      </div>

                      {/* Customer & Location Box */}
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-1.5 text-xs">
                        <p className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span>Customer: <strong className="text-slate-800">{selectedJob.customer_display_name}</strong></span>
                        </p>
                        {selectedJob.phone && (
                          <p className="flex items-center gap-2">
                            <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span>Phone: <a href={`tel:${selectedJob.phone}`} className="text-blue-600 font-bold hover:underline">{selectedJob.phone}</a></span>
                          </p>
                        )}
                        {selectedJob.email && (
                          <p className="flex items-center gap-2">
                            <Send className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span>Email: <a href={`mailto:${selectedJob.email}`} className="text-blue-600 hover:underline">{selectedJob.email}</a></span>
                          </p>
                        )}
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 pt-1 border-t border-slate-200/80">
                          <div className="flex items-start gap-2">
                            <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                            <div>
                              <span className="text-slate-500">Customer Location:</span>{' '}
                              <strong className="text-slate-800">{selectedJob.address}</strong>
                              {selectedJob.latitude != null && selectedJob.longitude != null && (
                                <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                                  Coordinates: {Number(selectedJob.latitude).toFixed(6)}, {Number(selectedJob.longitude).toFixed(6)}
                                </p>
                              )}
                            </div>
                          </div>
                          {selectedJob.latitude != null && selectedJob.longitude != null && (
                            <a
                              href={`https://www.google.com/maps/dir/?api=1&destination=${selectedJob.latitude},${selectedJob.longitude}`}
                              target="_blank"
                              rel="noreferrer"
                              className="shrink-0 text-[11px] bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded font-bold transition-colors inline-flex items-center gap-1 shadow-sm"
                            >
                              <span>Navigate ↗</span>
                            </a>
                          )}
                        </div>

                        <p className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span>Schedule: <strong className="text-slate-800">
                            {selectedJob.preferred_date
                              ? `${selectedJob.preferred_date}${selectedJob.preferred_time ? ` ${selectedJob.preferred_time}` : ''}`
                              : '—'}
                          </strong></span>
                        </p>
                        <p className="flex items-center gap-2">
                          <CreditCard className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span>Payment Mode: <strong className="text-slate-800">{selectedJob.payment_method || 'COD'}</strong> ({selectedJob.payment_status || 'pending'})</span>
                        </p>
                      </div>

                      {/* Selected Cart / Services Breakdown */}
                      {selectedJob.cart_data && selectedJob.cart_data.length > 0 && (
                        <div className="p-3 bg-blue-50/50 border border-blue-100 rounded text-xs space-y-2">
                          <div className="flex items-center justify-between border-b border-blue-200/60 pb-1.5">
                            <span className="font-bold text-slate-800 flex items-center gap-1.5">
                              <ShoppingBag className="w-3.5 h-3.5 text-blue-600" />
                              Booked Services & Cart ({selectedJob.cart_data.length})
                            </span>
                          </div>
                          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                            {selectedJob.cart_data.map((item, idx) => (
                              <div key={idx} className="flex items-start justify-between bg-white p-2 rounded border border-slate-200/80 text-[11px]">
                                <div>
                                  <span className="font-bold text-slate-800">{item.name || item.title || item.service_name || 'Service Item'}</span>
                                  {item.description && <p className="text-[10px] text-slate-500 line-clamp-1">{item.description}</p>}
                                  {item.selectedOption && <p className="text-[10px] text-blue-600 font-semibold">Option: {item.selectedOption}</p>}
                                </div>
                                {item.quantity && (
                                  <div className="text-right shrink-0 ml-2">
                                    <span className="font-mono font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
                                      Qty: {item.quantity}
                                    </span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Operational Action Controls */}
                      <div className="border-t border-slate-200 pt-3">
                        <h3 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                          Action Steps
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {(selectedJob.status === 'assigned' || selectedJob.active_offer?.status === 'OFFERED' || selectedJob.status === 'job_offered') && (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={actionLoading === selectedJob.id}
                                onClick={() => handleAcceptOffer(selectedJob.id)}
                                className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-colors"
                              >
                                {actionLoading === selectedJob.id ? 'Accepting...' : 'Accept Job Offer'}
                              </button>
                              <button
                                type="button"
                                disabled={actionLoading === selectedJob.id}
                                onClick={() => handleRejectOffer(selectedJob.id)}
                                className="px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors"
                              >
                                Decline
                              </button>
                            </div>
                          )}


                          {(selectedJob.status === 'accepted' || selectedJob.status === 'on_the_way' || selectedJob.status === 'arrived') && (
                            <div id="arrival-verification-checklist" className="w-full space-y-3.5 border border-slate-200 rounded-lg p-3.5 bg-slate-50/50 mt-1 scroll-mt-6">
                              {/* Interactive Live Customer Location & Navigation Tracking Map */}
                              <JobTrackingMap
                                job={selectedJob}
                                technicianLocation={currentLocation || user?.last_known_location || employee?.user?.last_known_location}
                                preServiceState={preServiceState}
                                geofenceRadius={300}
                              />

                              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                                  Arrival & Verification Checklist
                                </span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${preServiceState.is_complete ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                  {preServiceState.is_complete ? 'VERIFIED' : 'VERIFICATION REQUIRED'}
                                </span>
                              </div>

                              {/* Step 1: Automatic Location Geofence Verification (Zero-Manual-Arrival) */}
                              <div className="p-3 bg-white border border-slate-200 rounded flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                    <MapPin className="w-3.5 h-3.5 text-blue-600" />
                                    1. Location Verification (Geofence &le;300m)
                                  </h4>
                                  <p className="text-[10px] text-slate-500 mt-0.5">
                                    {preServiceState.geofence_passed
                                      ? 'Arrival verified automatically! You are inside the authorized 300m customer site geofence.'
                                      : 'Travel toward customer destination. Backend verifies arrival automatically once inside the 300m geofence with valid consecutive GPS fixes.'}
                                  </p>
                                </div>
                                {preServiceState.geofence_passed ? (
                                  <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 font-bold rounded text-xs border border-emerald-200 flex items-center gap-1 shrink-0">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    ARRIVAL VERIFIED ✓
                                  </span>
                                ) : (
                                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                                    <div className="flex items-center gap-2 px-2.5 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium border border-blue-200">
                                      <Compass className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                                      <span>Auto-Detecting Arrival...</span>
                                    </div>
                                    <button
                                      onClick={handleManualVerifyArrival}
                                      disabled={actionLoading === selectedJob?.id}
                                      className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-xs font-bold border border-amber-600 disabled:opacity-50 transition-colors"
                                    >
                                      {actionLoading === selectedJob?.id ? 'Verifying...' : '⚡ Verify Arrival Now'}
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Step 2: Verification Requirements */}
                              {preServiceState.geofence_passed ? (
                                <div className="p-3 bg-white border border-slate-200 rounded space-y-2.5">
                                  <h4 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-1.5 flex items-center gap-1">
                                    <Camera className="w-3.5 h-3.5 text-blue-600" />
                                    2. Required Pre-Service Evidence
                                  </h4>

                                  {/* Verification Code */}
                                  <div className="flex items-center justify-between text-xs pt-1">
                                    <div>
                                      <span className="font-semibold text-slate-800">Customer Verification Code</span>
                                      <p className="text-[10px] text-slate-500">Ask customer for the 6-digit verification code received on arrival</p>
                                    </div>
                                    {preServiceState.otp_verified ? (
                                      <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 font-bold rounded text-xs border border-emerald-200 flex items-center gap-1">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                        Verified ✓
                                      </span>
                                    ) : (
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <input
                                          type="text"
                                          maxLength={6}
                                          placeholder="6-digit OTP"
                                          value={otpInput}
                                          onChange={(e) => setOtpInput(e.target.value)}
                                          onKeyDown={(e) => e.key === 'Enter' && handleVerifyOtpSubmit()}
                                          className="w-24 px-2 py-1 border border-slate-300 rounded font-mono text-center text-xs font-bold tracking-widest placeholder:tracking-normal placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                        <button
                                          type="button"
                                          onClick={handleVerifyOtpSubmit}
                                          disabled={actionLoading === selectedJob.id || !otpInput.trim()}
                                          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-xs transition-colors disabled:opacity-50 active:scale-95"
                                        >
                                          {actionLoading === selectedJob.id ? 'Verifying...' : 'Verify OTP'}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={handleResendOtp}
                                          disabled={actionLoading === selectedJob.id}
                                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded border border-slate-300 transition-colors"
                                          title="Generate and send a fresh OTP to the customer"
                                        >
                                          Resend OTP
                                        </button>
                                      </div>
                                    )}
                                  </div>

                                  {/* Identity Photo */}
                                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                                    <div>
                                      <span className="font-semibold text-slate-800">Identity/Presence Photo</span>
                                      <p className="text-[10px] text-slate-500">Live selfie at job location showing identity</p>
                                    </div>
                                    {preServiceState.presence_photo ? (
                                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold rounded text-[10px] border border-emerald-200">
                                        Uploaded ✓
                                      </span>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => openLiveCamera('Capture Presence Selfie', 'user', 'presence_selfie', (file) => handlePhotoUploadSubmit('presence', file))}
                                        className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-xs transition-colors flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                                      >
                                        <Camera className="w-3.5 h-3.5" />
                                        <span>📸 Take Live Selfie</span>
                                      </button>
                                    )}
                                  </div>

                                  {/* Appliance Photo */}
                                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                                    <div>
                                      <span className="font-semibold text-slate-800">Before Appliance Photo</span>
                                      <p className="text-[10px] text-slate-500">Live photo of appliance condition before work</p>
                                    </div>
                                    {preServiceState.appliance_photo ? (
                                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold rounded text-[10px] border border-emerald-200">
                                        Uploaded ✓
                                      </span>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => openLiveCamera('Capture Before Appliance Photo', 'environment', 'pre_appliance', (file) => handlePhotoUploadSubmit('appliance', file))}
                                        className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-xs transition-colors flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                                      >
                                        <Camera className="w-3.5 h-3.5" />
                                        <span>📸 Take Live Photo</span>
                                      </button>
                                    )}
                                  </div>

                                  {/* Work Area Photo */}
                                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                                    <div>
                                      <span className="font-semibold text-slate-800">Before Work-Area Photo</span>
                                      <p className="text-[10px] text-slate-500">Live photo of work area condition before work</p>
                                    </div>
                                    {preServiceState.work_area_photo ? (
                                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold rounded text-[10px] border border-emerald-200">
                                        Uploaded ✓
                                      </span>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => openLiveCamera('Capture Before Work-Area Photo', 'environment', 'pre_work_area', (file) => handlePhotoUploadSubmit('work_area', file))}
                                        className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-xs transition-colors flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                                      >
                                        <Camera className="w-3.5 h-3.5" />
                                        <span>📸 Take Live Photo</span>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className="p-3 bg-slate-100/70 border border-slate-200 rounded space-y-2 text-slate-500">
                                  <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                                      <Camera className="w-3.5 h-3.5 text-slate-400" />
                                      2. Required Pre-Service Evidence (OTP & Photos)
                                    </h4>
                                    <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-200 text-slate-600 rounded">
                                      🔒 UNLOCKS ON ARRIVAL
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-slate-500">
                                    Customer OTP input and 3 photo upload buttons will unlock immediately once Step 1 Arrival is verified.
                                  </p>
                                </div>
                              )}

                              {/* Service Gate Banner */}
                              {preServiceState.is_complete ? (
                                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-emerald-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                  <div>
                                    <h4 className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                      Pre-Service Verification Complete!
                                    </h4>
                                    <p className="text-[10px] text-emerald-700 mt-0.5">
                                      All arrival, OTP, and evidence verified. Click below to verify fresh GPS and clock in.
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={handleDirectJobClockIn}
                                    disabled={actionLoading === selectedJob.id}
                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-xs shadow transition-colors flex items-center gap-1.5 shrink-0 justify-center"
                                  >
                                    <Play className="w-3.5 h-3.5" />
                                    <span>{actionLoading === selectedJob.id ? 'Verifying GPS & Clocking In...' : 'CLOCK IN & START WORK'}</span>
                                  </button>
                                </div>
                              ) : (
                                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-amber-900 text-[11px] font-medium flex items-center gap-2">
                                  <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                                  <span>Clock-In is locked: Complete GPS arrival verification, Customer OTP, and mandatory photo evidence above.</span>
                                </div>
                              )}
                            </div>

                          )}

                          {/* Active Scope Extensions Subsystem */}
                          {selectedJob.extensions && selectedJob.extensions.length > 0 && (
                            <div className="w-full p-3 bg-slate-50 border border-slate-200 rounded space-y-2">
                              <h4 className="text-xs font-bold text-slate-800 flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                  <PlusCircle className="w-3.5 h-3.5 text-indigo-600" />
                                  Scope Extensions ({selectedJob.extensions.length})
                                </span>
                              </h4>
                              <div className="space-y-2">
                                {selectedJob.extensions.map((ext) => (
                                  <div key={ext.id} className="p-2.5 bg-white border border-slate-200 rounded text-xs space-y-1.5 shadow-sm">
                                    <div className="flex items-center justify-between">
                                      <span className="font-bold text-slate-900">{ext.title}</span>
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                        ext.status === 'REQUESTED' ? 'bg-amber-100 text-amber-800' :
                                        ext.status === 'ADMIN_APPROVED' ? 'bg-blue-100 text-blue-800' :
                                        ext.status === 'ADMIN_REJECTED' ? 'bg-red-100 text-red-800' :
                                        ext.status === 'CUSTOMER_ACCEPTED' ? 'bg-emerald-100 text-emerald-800' :
                                        ext.status === 'CUSTOMER_DECLINED' ? 'bg-rose-100 text-rose-800' :
                                        ext.status === 'IN_PROGRESS' ? 'bg-indigo-100 text-indigo-800' :
                                        'bg-emerald-100 text-emerald-800'
                                      }`}>
                                        {ext.status.replace('_', ' ')}
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-slate-600">{ext.reason}</p>
                                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-700 pt-1 border-t border-slate-100">
                                      <span>Estimate: ₹{ext.requested_amount} (Labor: ₹{ext.estimated_labor_cost}, Materials: ₹{ext.estimated_materials_cost})</span>
                                      {ext.approved_amount && <span className="font-bold text-blue-700">Approved: ₹{ext.approved_amount}</span>}
                                    </div>
                                    {ext.is_critical && (
                                      <span className="inline-block text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                                        ⚠️ Critical Scope (Job cannot proceed if declined)
                                      </span>
                                    )}

                                    {/* Actions based on extension status */}
                                    {ext.status === 'ADMIN_APPROVED' && (
                                      <div className="flex items-center gap-2 pt-1">
                                        <span className="text-[10px] font-semibold text-slate-500">Customer Decision:</span>
                                        <button
                                          type="button"
                                          onClick={() => handleCustomerDecideExtensionAction(selectedJob.id, ext.id, 'ACCEPT')}
                                          disabled={actionLoading === `ext-${ext.id}`}
                                          className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-[10px]"
                                        >
                                          Customer Accepts
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleCustomerDecideExtensionAction(selectedJob.id, ext.id, 'DECLINE')}
                                          disabled={actionLoading === `ext-${ext.id}`}
                                          className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded text-[10px]"
                                        >
                                          Customer Declines
                                        </button>
                                      </div>
                                    )}

                                    {ext.status === 'CUSTOMER_ACCEPTED' && !ext.requires_specialist && (
                                      <div className="pt-1">
                                        <button
                                          type="button"
                                          onClick={() => handleProgressExtensionAction(selectedJob.id, ext.id, 'start')}
                                          disabled={actionLoading === `ext-${ext.id}`}
                                          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded text-[10px]"
                                        >
                                          Start Additional Work
                                        </button>
                                      </div>
                                    )}

                                    {ext.status === 'IN_PROGRESS' && (
                                      <div className="pt-1">
                                        <button
                                          type="button"
                                          onClick={() => handleProgressExtensionAction(selectedJob.id, ext.id, 'complete')}
                                          disabled={actionLoading === `ext-${ext.id}`}
                                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-[10px]"
                                        >
                                          Mark Additional Work Completed
                                        </button>
                                      </div>
                                    )}

                                    {ext.status === 'COMPLETED' && (
                                      <div className="pt-1">
                                        <button
                                          type="button"
                                          onClick={() => handleProgressExtensionAction(selectedJob.id, ext.id, 'resolve')}
                                          disabled={actionLoading === `ext-${ext.id}`}
                                          className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded text-[10px]"
                                        >
                                          Resolve Extension
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {selectedJob.status === 'unable_to_complete' && (
                            <div className="w-full p-3 bg-rose-50 border border-rose-200 rounded text-rose-900">
                              <h4 className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
                                <AlertTriangle className="w-4 h-4 text-rose-600" />
                                Job Status: Unable to Complete
                              </h4>
                              <p className="text-[11px] text-rose-700 mt-1 whitespace-pre-wrap">
                                {selectedJob.description?.includes('[UNABLE_TO_COMPLETE]')
                                  ? selectedJob.description.split('[UNABLE_TO_COMPLETE]:')[1]
                                  : 'A critical scope extension was declined by the customer, and work cannot safely proceed.'}
                              </p>
                            </div>
                          )}

                          {selectedJob.status === 'in_progress' && (
                            <div className="w-full p-4 bg-emerald-50/80 border border-emerald-200 rounded-lg space-y-3 mt-1">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200/70 pb-2.5">
                                <div className="flex items-center gap-2">
                                  <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                                  <div>
                                    <h4 className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                                      <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                                      Active Work Session — Job In Progress
                                    </h4>
                                    <p className="text-[11px] text-emerald-700">
                                      Clocked in on site. When repairs & service are finished, upload completion photos below to complete the service.
                                    </p>
                                  </div>
                                </div>
                                <span className="px-2.5 py-1 bg-emerald-600 text-white font-bold text-xs rounded shadow-xs self-start sm:self-auto shrink-0">
                                  IN PROGRESS
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                                <button
                                  type="button"
                                  onClick={() => setProofModalJob(selectedJob)}
                                  className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow transition-colors inline-flex items-center gap-2 active:scale-95 cursor-pointer"
                                >
                                  <Camera className="w-4 h-4" />
                                  <span>Submit Completion Proof</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setExtensionModalJob(selectedJob)}
                                  className="px-3.5 py-2 rounded bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold text-xs shadow-xs transition-colors inline-flex items-center gap-1.5 active:scale-95 cursor-pointer"
                                >
                                  <PlusCircle className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>Request Scope Extension</span>
                                </button>
                              </div>
                            </div>
                          )}

                          {selectedJob.status === 'proof_submitted' && (
                            <div className="w-full p-4 bg-blue-50/90 border border-blue-200 rounded-lg space-y-2.5 mt-1">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-full bg-blue-100 border border-blue-300 flex items-center justify-center text-blue-700 shrink-0">
                                    <CheckCircle2 className="w-5 h-5" />
                                  </div>
                                  <div>
                                    <h4 className="text-xs font-bold text-blue-950">Service Completed — Proof Submitted</h4>
                                    <p className="text-[11px] text-blue-700">
                                      After-service proof verified. Please settle and confirm payment below to close and complete this job.
                                    </p>
                                  </div>
                                </div>
                                <span className="px-2.5 py-1 bg-blue-700 text-white font-bold text-xs rounded shadow-xs shrink-0">
                                  PROOF SUBMITTED
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Payment State Machine & Cash Collection Section */}
                          {['in_progress', 'proof_submitted', 'completed'].includes(selectedJob.status) && (
                            <div className="w-full mt-2 space-y-2">
                              {((selectedJob.payment?.payment_method || selectedJob.payment_method || '').toUpperCase() === 'ONLINE' || (selectedJob.payment?.payment_method || selectedJob.payment_method || '').toUpperCase() === 'PREPAID') ? (
                                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                    <div>
                                      <span className="text-xs font-bold text-slate-800">Payment: ONLINE (Prepaid)</span>
                                      <p className="text-[11px] text-slate-600">
                                        Amount: <strong className="font-mono">₹{selectedJob.payment?.amount_due || selectedJob.total_amount}</strong> • No cash collection required.
                                      </p>
                                    </div>
                                  </div>
                                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded">
                                    {selectedJob.payment?.payment_status === 'PAID' || selectedJob.payment_status === 'paid' ? 'PAID ONLINE ✓' : 'GATEWAY PENDING'}
                                  </span>
                                </div>
                              ) : (
                                (selectedJob.payment?.payment_status === 'PAID' || selectedJob.payment_status === 'paid' || selectedJob.payment_status === 'collected') ? (
                                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                      <div>
                                        <span className="text-xs font-bold text-emerald-900">Cash Payment Confirmed & Collected</span>
                                        <p className="text-[11px] text-emerald-700">
                                          Amount: <strong className="font-mono">₹{selectedJob.payment?.amount_paid || selectedJob.payment?.amount_due || selectedJob.total_amount}</strong> • Received by Technician
                                        </p>
                                      </div>
                                    </div>
                                    <span className="px-2 py-0.5 bg-emerald-700 text-white text-[10px] font-bold rounded">
                                      PAID ✓
                                    </span>
                                  </div>
                                ) : (
                                  <div className="p-3.5 bg-amber-50/90 border border-amber-300 rounded-lg space-y-2">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <DollarSign className="w-4 h-4 text-amber-700" />
                                        <span className="text-xs font-bold text-amber-950">Payment Collection (Cash on Service)</span>
                                      </div>
                                      <span className="text-xs font-bold text-amber-900 font-mono">
                                        ₹{selectedJob.payment?.amount_due || selectedJob.total_amount} DUE
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-amber-800">
                                      Collect cash payment from the customer upon completing work. (No OTP required)
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setCashModalJob(selectedJob);
                                        setCashAmountReceived(String(selectedJob.payment?.amount_due || selectedJob.total_amount || ''));
                                      }}
                                      className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded text-xs shadow-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                                    >
                                      <DollarSign className="w-4 h-4" />
                                      <span>COLLECT ₹{selectedJob.payment?.amount_due || selectedJob.total_amount} CASH</span>
                                    </button>
                                  </div>
                                )
                              )}
                            </div>
                          )}

                          {selectedJob.status === 'completed' && (
                            <div className="w-full p-4 bg-emerald-50/90 border border-emerald-200 rounded-lg space-y-3 mt-1">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-700 shrink-0">
                                    <CheckCircle2 className="w-5 h-5" />
                                  </div>
                                  <div>
                                    <h4 className="text-xs font-bold text-emerald-900">Job Successfully Completed</h4>
                                    <p className="text-[11px] text-emerald-700">
                                      All service tasks finished, completion proof submitted, and payment verified.
                                    </p>
                                  </div>
                                </div>
                                <span className="px-2.5 py-1 bg-emerald-700 text-white font-bold text-xs rounded shadow-xs shrink-0">
                                  COMPLETED ✓
                                </span>
                              </div>

                              <div className="pt-2.5 border-t border-emerald-200/80 grid grid-cols-2 gap-2 text-xs">
                                <div className="bg-white/80 p-2 rounded border border-emerald-200/60">
                                  <span className="text-[10px] text-slate-500 block font-semibold">Payment Collection</span>
                                  <span className="font-bold text-slate-800">{selectedJob.payment_method || 'CASH'} ({selectedJob.payment_status || 'verified'})</span>
                                </div>
                                <div className="bg-white/80 p-2 rounded border border-emerald-200/60">
                                  <span className="text-[10px] text-slate-500 block font-semibold">Service Value</span>
                                  <span className="font-bold text-emerald-800 font-mono">₹{selectedJob.total_amount || '—'}</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-16 text-center text-xs text-slate-500 space-y-3">
                      <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-2xs">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm">
                          {isOnline ? 'Standby — Ready for Assignments' : 'No Active Job Selected'}
                        </p>
                        <p className="text-[11px] text-slate-500 max-w-sm mx-auto mt-1">
                          {isOnline
                            ? 'All assigned jobs completed. Keep status ONLINE to receive incoming automated dispatch job offers.'
                            : 'Select a job from the active queue or toggle ONLINE to receive dispatch bookings.'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

        {/* Modal: Apply Leave */}
        <Modal
          isOpen={showLeaveModal}
          onClose={() => setShowLeaveModal(false)}
          title="Apply for Absence / Leave"
        >
          <form onSubmit={handleApplyLeaveSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Leave Type</label>
              <select
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-2 text-slate-800"
              >
                <option value="Casual Leave">Casual Leave</option>
                <option value="Sick Leave">Sick Leave</option>
                <option value="Emergency Leave">Emergency Leave</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Start Date</label>
                <input
                  type="date"
                  required
                  value={leaveStart}
                  onChange={(e) => setLeaveStart(e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-slate-800"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">End Date</label>
                <input
                  type="date"
                  required
                  value={leaveEnd}
                  onChange={(e) => setLeaveEnd(e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-slate-800"
                />
              </div>
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Reason</label>
              <textarea
                required
                rows={3}
                value={leaveReason}
                onChange={(e) => setLeaveReason(e.target.value)}
                placeholder="State your reason..."
                className="w-full border border-slate-300 rounded px-3 py-2 text-slate-800"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowLeaveModal(false)}
                className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingLeave}
                className="px-4 py-1.5 rounded bg-blue-600 text-white font-bold hover:bg-blue-700"
              >
                {isSubmittingLeave ? 'Submitting...' : 'Submit Application'}
              </button>
            </div>
          </form>
        </Modal>

        {/* Modal: Proof of Work */}
        <Modal
          isOpen={Boolean(proofModalJob)}
          onClose={() => {
            setProofModalJob(null);
            setBeforeFile(null);
            setAfterFile(null);
            if (beforePreviewUrl) URL.revokeObjectURL(beforePreviewUrl);
            if (afterPreviewUrl) URL.revokeObjectURL(afterPreviewUrl);
            setBeforePreviewUrl(null);
            setAfterPreviewUrl(null);
          }}
          title={`Proof of Work Completion — Job #${proofModalJob?.id}`}
        >
          <form onSubmit={handleProofSubmit} className="space-y-4 text-xs">
            {/* Live Camera Real-Time Photo 1: Before Work Area Photo */}
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Before Photo (Pre-Work Condition)
              </label>
              {beforeFile ? (
                <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center gap-2.5">
                    {beforePreviewUrl ? (
                      <img
                        src={beforePreviewUrl}
                        alt="Before"
                        className="w-12 h-12 object-cover rounded-lg border border-slate-300 shadow-sm"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                        <Camera className="w-6 h-6" />
                      </div>
                    )}
                    <div>
                      <span className="font-bold text-xs text-slate-800 block truncate max-w-[180px]">
                        {beforeFile.name || 'Before Photo Captured'}
                      </span>
                      <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Live snapshot attached
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      openLiveCamera(
                        'Capture Before Photo',
                        'environment',
                        'before_work',
                        (file, previewUrl) => {
                          setBeforeFile(file);
                          setBeforePreviewUrl(previewUrl);
                        }
                      )
                    }
                    className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" /> Retake
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    openLiveCamera(
                      'Capture Before Photo',
                      'environment',
                      'before_work',
                      (file, previewUrl) => {
                        setBeforeFile(file);
                        setBeforePreviewUrl(previewUrl);
                      }
                    )
                  }
                  className="w-full py-3 px-4 border-2 border-dashed border-blue-300 hover:border-blue-500 bg-blue-50/50 hover:bg-blue-50 text-blue-700 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.99] shadow-sm cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-blue-600" />
                  <span>📸 Take Live Photo (Before Work)</span>
                </button>
              )}
            </div>

            {/* Live Camera Real-Time Photo 2: After Appliance / Work Photo */}
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                After Photo (Completed Work Result)
              </label>
              {afterFile ? (
                <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center gap-2.5">
                    {afterPreviewUrl ? (
                      <img
                        src={afterPreviewUrl}
                        alt="After"
                        className="w-12 h-12 object-cover rounded-lg border border-slate-300 shadow-sm"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600">
                        <Camera className="w-6 h-6" />
                      </div>
                    )}
                    <div>
                      <span className="font-bold text-xs text-slate-800 block truncate max-w-[180px]">
                        {afterFile.name || 'After Photo Captured'}
                      </span>
                      <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Live snapshot attached
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      openLiveCamera(
                        'Capture After Photo',
                        'environment',
                        'after_work',
                        (file, previewUrl) => {
                          setAfterFile(file);
                          setAfterPreviewUrl(previewUrl);
                        }
                      )
                    }
                    className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" /> Retake
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    openLiveCamera(
                      'Capture After Photo',
                      'environment',
                      'after_work',
                      (file, previewUrl) => {
                        setAfterFile(file);
                        setAfterPreviewUrl(previewUrl);
                      }
                    )
                  }
                  className="w-full py-3 px-4 border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-700 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.99] shadow-sm cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-emerald-600" />
                  <span>📸 Take Live Photo (After Work)</span>
                </button>
              )}
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Completion Notes</label>
              <textarea
                rows={3}
                value={workNotes}
                onChange={(e) => setWorkNotes(e.target.value)}
                placeholder="Details of service provided, parts replaced, or tests performed..."
                className="w-full border border-slate-300 rounded px-3 py-2"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setProofModalJob(null);
                  setBeforeFile(null);
                  setAfterFile(null);
                  if (beforePreviewUrl) URL.revokeObjectURL(beforePreviewUrl);
                  if (afterPreviewUrl) URL.revokeObjectURL(afterPreviewUrl);
                  setBeforePreviewUrl(null);
                  setAfterPreviewUrl(null);
                }}
                className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUploadingProof || (!beforeFile && !afterFile)}
                className="px-4 py-1.5 rounded bg-emerald-600 disabled:opacity-50 text-white font-bold hover:bg-emerald-700 shadow-sm cursor-pointer"
              >
                {isUploadingProof ? 'Uploading...' : 'Complete Job'}
              </button>
            </div>
          </form>
        </Modal>

        {/* Modal: Request Scope / Work Extension */}
        <Modal
          isOpen={Boolean(extensionModalJob)}
          onClose={() => setExtensionModalJob(null)}
          title={`Request Scope Extension — Job #${extensionModalJob?.id}`}
        >
          <form onSubmit={handleExtensionSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Extension Title</label>
              <input
                type="text"
                required
                placeholder="e.g. Additional Wiring / Deep Cleaning"
                value={extTitle}
                onChange={(e) => setExtTitle(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-2 text-slate-800"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Estimated Labor (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  placeholder="0.00"
                  value={extLaborCost}
                  onChange={(e) => setExtLaborCost(e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-slate-800"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Estimated Materials (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={extMaterialsCost}
                  onChange={(e) => setExtMaterialsCost(e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-slate-800"
                />
              </div>
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Reason / Justification</label>
              <textarea
                required
                rows={3}
                placeholder="Detailed reason for additional scope..."
                value={extReason}
                onChange={(e) => setExtReason(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-2 text-slate-800"
              />
            </div>
            <div className="space-y-2 pt-1 border-t border-slate-100">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={extIsCritical}
                  onChange={(e) => setExtIsCritical(e.target.checked)}
                  className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                />
                <span className="text-slate-700 font-medium">
                  <strong>Critical Scope:</strong> Job cannot proceed safely if customer declines this extension.
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={extRequiresSpecialist}
                  onChange={(e) => setExtRequiresSpecialist(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-slate-700 font-medium">
                  <strong>Requires Specialist:</strong> Handover to another specialist technician instead of continuing work yourself.
                </span>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setExtensionModalJob(null)}
                className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingExt}
                className="px-4 py-1.5 rounded bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-sm"
              >
                {isSubmittingExt ? 'Submitting...' : 'Submit Extension Request'}
              </button>
            </div>
          </form>
        </Modal>

        {/* Modal: Structured Decline Job Offer */}
        <Modal
          isOpen={Boolean(declineModalJob)}
          onClose={() => setDeclineModalJob(null)}
          title={`Decline Job Offer — Job #${declineModalJob?.id}`}
        >
          <form onSubmit={handleConfirmDeclineOffer} className="space-y-4 text-xs">
            <p className="text-slate-600">
              Please select a reason for declining this job offer. The system will immediately dispatch the job to the next available technician.
            </p>

            <div className="space-y-2.5 bg-slate-50 p-3 rounded border border-slate-200">
              {[
                'Too far',
                'Busy / Heavy traffic',
                'Vehicle issue',
                'Service mismatch',
                'Personal reason',
                'Other',
              ].map((reason) => (
                <label key={reason} className="flex items-center gap-2.5 cursor-pointer text-slate-800 font-medium">
                  <input
                    type="radio"
                    name="declineReason"
                    value={reason}
                    checked={selectedDeclineReason === reason}
                    onChange={(e) => setSelectedDeclineReason(e.target.value)}
                    className="text-rose-600 focus:ring-rose-500"
                  />
                  <span>{reason}</span>
                </label>
              ))}
            </div>

            {selectedDeclineReason === 'Other' && (
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Custom Reason</label>
                <input
                  type="text"
                  required
                  placeholder="Specify reason..."
                  value={customDeclineReason}
                  onChange={(e) => setCustomDeclineReason(e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-slate-800"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setDeclineModalJob(null)}
                className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50"
              >
                Keep Offer
              </button>
              <button
                type="submit"
                disabled={isDecliningOffer}
                className="px-4 py-1.5 rounded bg-rose-600 text-white font-bold hover:bg-rose-700 shadow-sm"
              >
                {isDecliningOffer ? 'Declining...' : 'Confirm Decline'}
              </button>
            </div>
          </form>
        </Modal>

        {/* Cash Collection Modal */}
        <Modal
          isOpen={Boolean(cashModalJob)}
          onClose={() => setCashModalJob(null)}
          title={`Collect Cash — Job #${cashModalJob?.id || ''}`}
        >
          {cashModalJob && (
            <form onSubmit={handleCashCollectSubmit} className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-amber-800 font-semibold">Service:</span>
                  <span className="font-bold text-amber-950">{cashModalJob.service_title || cashModalJob.issue_title || 'Service'}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-amber-800 font-semibold">Authoritative Amount Due:</span>
                  <span className="font-mono font-bold text-base text-amber-950">
                    ₹{cashModalJob.payment?.amount_due || cashModalJob.total_amount}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Cash Amount Received from Customer (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-sm">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min={parseFloat(cashModalJob.payment?.amount_due || cashModalJob.total_amount || 0)}
                    required
                    value={cashAmountReceived}
                    onChange={(e) => setCashAmountReceived(e.target.value)}
                    placeholder={String(cashModalJob.payment?.amount_due || cashModalJob.total_amount || '')}
                    className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg text-sm font-mono font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
                  />
                </div>
              </div>

              {/* Calculated Change Returned */}
              {parseFloat(cashAmountReceived || 0) > parseFloat(cashModalJob.payment?.amount_due || cashModalJob.total_amount || 0) && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex justify-between items-center">
                  <span className="text-xs font-semibold text-emerald-800">Change to Return Customer:</span>
                  <span className="font-mono font-bold text-sm text-emerald-950">
                    ₹{(parseFloat(cashAmountReceived || 0) - parseFloat(cashModalJob.payment?.amount_due || cashModalJob.total_amount || 0)).toFixed(2)}
                  </span>
                </div>
              )}

              <p className="text-[11px] text-slate-500">
                Submitting will generate a secure 6-digit confirmation code for the customer and notify them to confirm payment receipt.
              </p>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setCashModalJob(null)}
                  className="px-3.5 py-1.5 rounded border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCollectingCash || !cashAmountReceived || parseFloat(cashAmountReceived) < parseFloat(cashModalJob.payment?.amount_due || cashModalJob.total_amount || 0)}
                  className="px-4 py-2 rounded bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <DollarSign className="w-4 h-4" />
                  <span>{isCollectingCash ? 'Recording...' : 'Confirm Cash Received'}</span>
                </button>
              </div>
            </form>
          )}
        </Modal>

        {/* Real-Time Live Camera Viewfinder & Snapshot Modal */}
        <LiveCameraCaptureModal
          isOpen={cameraModalConfig.isOpen}
          onClose={closeLiveCamera}
          title={cameraModalConfig.title}
          defaultFacingMode={cameraModalConfig.defaultFacingMode}
          fileNamePrefix={cameraModalConfig.fileNamePrefix}
          onCapture={(file, previewUrl) => {
            if (cameraModalConfig.onCapture) {
              cameraModalConfig.onCapture(file, previewUrl);
            }
          }}
        />
      </div>
    </AppShell>
  );
}

export default EmployeeDashboardPage;
