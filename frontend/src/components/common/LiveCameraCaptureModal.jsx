import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, RefreshCw, Check, X, AlertCircle, SwitchCamera, Sparkles, User, Scan } from 'lucide-react';

/**
 * LiveCameraCaptureModal
 * 
 * High-performance, biometric-quality real-time camera viewfinder.
 * Features:
 *  - Dedicated Face / Selfie Portrait Oval Guide for technician identity verification.
 *  - Clean Product & Appliance framing box for work evidence photos.
 *  - Natural mirrored video stream for front selfies.
 *  - Instant Front/Rear camera switching.
 *  - Flash snapshot animation upon capture.
 */
export function LiveCameraCaptureModal({
  isOpen,
  onClose,
  onCapture,
  title = 'Live Camera Photo Capture',
  defaultFacingMode = 'environment',
  fileNamePrefix = 'photo',
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const isSelfie = defaultFacingMode === 'user' || fileNamePrefix.includes('selfie') || fileNamePrefix.includes('presence') || fileNamePrefix.includes('face');
  const [facingMode, setFacingMode] = useState(defaultFacingMode);
  const [capturedImage, setCapturedImage] = useState(null); // { blob, file, previewUrl }
  const [hasCameraPermission, setHasCameraPermission] = useState(null); // null = checking, true, false
  const [errorMessage, setErrorMessage] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);
  const [cameraDevices, setCameraDevices] = useState([]);
  const [isFlashing, setIsFlashing] = useState(false);

  // Stop camera tracks cleanly
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Initialize camera stream
  const startCamera = useCallback(async (facing) => {
    stopStream();
    setErrorMessage('');
    setHasCameraPermission(null);

    if (typeof window === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setHasCameraPermission(false);
      setErrorMessage('Your browser does not support live camera access. Please use a modern browser.');
      return;
    }

    try {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === 'videoinput');
        setCameraDevices(videoInputs);
      } catch (_) {}

      const constraints = {
        audio: false,
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(() => {});
        };
      }
      setHasCameraPermission(true);
    } catch (err) {
      console.warn('[Camera] Primary constraint failed, trying fallback:', err);
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        streamRef.current = fallbackStream;
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(() => {});
          };
        }
        setHasCameraPermission(true);
      } catch (fallbackErr) {
        console.error('[Camera] Access denied or unavailable:', fallbackErr);
        setHasCameraPermission(false);
        if (fallbackErr.name === 'NotAllowedError' || fallbackErr.name === 'PermissionDeniedError') {
          setErrorMessage('Camera access was denied. Please allow camera permissions in your browser.');
        } else if (fallbackErr.name === 'NotFoundError' || fallbackErr.name === 'DevicesNotFoundError') {
          setErrorMessage('No camera device found on this system.');
        } else {
          setErrorMessage(fallbackErr.message || 'Unable to connect to camera.');
        }
      }
    }
  }, [stopStream]);

  // Start camera when modal opens
  useEffect(() => {
    if (isOpen) {
      setCapturedImage(null);
      setFacingMode(defaultFacingMode);
      startCamera(defaultFacingMode);
    } else {
      stopStream();
      if (capturedImage?.previewUrl) {
        URL.revokeObjectURL(capturedImage.previewUrl);
      }
      setCapturedImage(null);
    }
    return () => {
      stopStream();
    };
  }, [isOpen, defaultFacingMode, startCamera, stopStream]);

  // Toggle front/back camera
  const handleToggleFacingMode = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  // Capture snapshot from video stream
  const handleTakeSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;
    setIsCapturing(true);
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 200);

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 720;

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      // Mirror horizontally if using front user camera for natural selfie
      if (facingMode === 'user') {
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(video, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            setErrorMessage('Failed to capture frame from video.');
            setIsCapturing(false);
            return;
          }

          const fileName = `${fileNamePrefix}_${Date.now()}.jpg`;
          const file = new File([blob], fileName, { type: 'image/jpeg', lastModified: Date.now() });
          const previewUrl = URL.createObjectURL(blob);

          setCapturedImage({ blob, file, previewUrl });
          stopStream();
          setIsCapturing(false);
        },
        'image/jpeg',
        0.92
      );
    } catch (err) {
      console.error('[Camera] Capture error:', err);
      setErrorMessage('Error capturing frame.');
      setIsCapturing(false);
    }
  };

  // Retake photo
  const handleRetake = () => {
    if (capturedImage?.previewUrl) {
      URL.revokeObjectURL(capturedImage.previewUrl);
    }
    setCapturedImage(null);
    startCamera(facingMode);
  };

  // Confirm and return photo
  const handleConfirm = () => {
    if (!capturedImage) return;
    onCapture(capturedImage.file, capturedImage.previewUrl);
    onClose();
  };

  // Native device camera fallback via input
  const handleNativeFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const previewUrl = URL.createObjectURL(file);
      onCapture(file, previewUrl);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
              {isSelfie ? <User className="w-4 h-4 text-blue-400" /> : <Camera className="w-4 h-4 text-blue-400" />}
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100">{title}</h3>
              <p className="text-[10px] text-slate-400">
                {isSelfie ? 'Position face inside the oval frame' : 'Align subject inside frame'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleFacingMode}
              disabled={!hasCameraPermission}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors border border-slate-700"
              title="Flip Camera (Front / Rear)"
            >
              <SwitchCamera className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors border border-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Camera Viewfinder / Preview Container */}
        <div className="relative bg-black flex-1 flex items-center justify-center min-h-[380px] max-h-[480px] overflow-hidden">
          {/* Hidden Canvas for Frame Capture */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Flash Shutter Animation */}
          {isFlashing && <div className="absolute inset-0 bg-white z-50 animate-fadeOut pointer-events-none" />}

          {/* Captured Image Review State */}
          {capturedImage ? (
            <div className="relative w-full h-full flex items-center justify-center bg-black">
              <img
                src={capturedImage.previewUrl}
                alt="Captured Snapshot"
                className="max-h-[460px] w-full object-contain"
              />
              <div className="absolute top-3 left-3 bg-emerald-600/95 backdrop-blur text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-lg border border-emerald-400/40">
                <Check className="w-3.5 h-3.5" />
                <span>Photo Captured</span>
              </div>
            </div>
          ) : hasCameraPermission === true ? (
            /* Live Camera Video Feed */
            <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover min-h-[380px] max-h-[480px] ${
                  facingMode === 'user' ? 'scale-x-[-1]' : ''
                }`}
              />

              {/* ── PROPER BIOMETRIC FACE OVAL GUIDE FOR SELFIES ── */}
              {isSelfie ? (
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                  {/* Subtle dark vignette around oval */}
                  <div className="relative w-56 h-72 sm:w-60 sm:h-80 rounded-[50%] border-2 border-dashed border-cyan-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.38)] flex flex-col items-center justify-between p-4 animate-pulse">
                    {/* Top Guide Indicator */}
                    <div className="w-6 h-1 bg-cyan-400/80 rounded-full" />

                    {/* Face Silhouette Guide Icon */}
                    <div className="opacity-20 text-cyan-300">
                      <User className="w-24 h-24 stroke-[1]" />
                    </div>

                    {/* Bottom Guide Indicator */}
                    <div className="w-6 h-1 bg-cyan-400/80 rounded-full" />
                  </div>

                  {/* Guidance Helper Pill */}
                  <div className="mt-3 px-3 py-1 bg-slate-900/90 backdrop-blur-md rounded-full border border-cyan-500/40 text-cyan-200 text-[11px] font-semibold flex items-center gap-1.5 shadow-lg">
                    <Scan className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Fit face inside oval & hold still</span>
                  </div>
                </div>
              ) : (
                /* Standard Product / Work Area Framing Guide */
                <div className="absolute inset-8 border-2 border-white/40 rounded-2xl pointer-events-none flex flex-col justify-between p-3">
                  <div className="flex justify-between">
                    <div className="w-5 h-5 border-t-2 border-l-2 border-blue-400" />
                    <div className="w-5 h-5 border-t-2 border-r-2 border-blue-400" />
                  </div>
                  <div className="flex justify-between">
                    <div className="w-5 h-5 border-b-2 border-l-2 border-blue-400" />
                    <div className="w-5 h-5 border-b-2 border-r-2 border-blue-400" />
                  </div>
                </div>
              )}

              {/* Live Status Badge */}
              <div className="absolute top-3 left-3 bg-red-600/90 backdrop-blur text-white px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider flex items-center gap-1.5 shadow border border-red-400/30">
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                LIVE
              </div>

              {/* Camera Mode Indicator Pill */}
              <div className="absolute top-3 right-3 bg-slate-900/80 backdrop-blur text-slate-300 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border border-slate-700">
                {facingMode === 'user' ? 'Front Camera' : 'Rear Camera'}
              </div>
            </div>
          ) : hasCameraPermission === false ? (
            /* Permission Denied or Error State */
            <div className="p-6 text-center max-w-sm">
              <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 mx-auto flex items-center justify-center mb-3">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h4 className="text-white font-bold text-sm mb-1">Camera Access Required</h4>
              <p className="text-slate-400 text-xs mb-4">{errorMessage}</p>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => startCamera(facingMode)}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Retry Camera
                </button>

                <label className="block w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg text-xs border border-slate-700 cursor-pointer transition-colors text-center">
                  <span>Use Device Camera Direct</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture={facingMode}
                    onChange={handleNativeFileChange}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          ) : (
            /* Loading / Starting Camera */
            <div className="flex flex-col items-center justify-center gap-3 text-slate-400 p-8">
              <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
              <span className="text-xs font-medium">Opening live camera...</span>
            </div>
          )}
        </div>

        {/* Footer Controls */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-3">
          {capturedImage ? (
            <>
              <button
                type="button"
                onClick={handleRetake}
                className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 flex items-center justify-center gap-2 transition-colors active:scale-95 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Retake
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2 transition-colors active:scale-95 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                Use Photo
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleTakeSnapshot}
                disabled={!hasCameraPermission || isCapturing}
                className="flex-1 py-3 px-5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-blue-900/40 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                <div className="w-4 h-4 rounded-full border-2 border-white flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                </div>
                <span>{isCapturing ? 'Capturing...' : isSelfie ? 'Capture Face Selfie' : 'Capture Photo'}</span>
              </button>

              <button
                type="button"
                onClick={handleToggleFacingMode}
                disabled={!hasCameraPermission}
                className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                title="Flip Camera"
              >
                <SwitchCamera className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
