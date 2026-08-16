import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, RefreshCw, Check, X, AlertCircle, SwitchCamera, Sparkles } from 'lucide-react';

/**
 * LiveCameraCaptureModal
 * 
 * Provides real-time camera viewfinder streaming using navigator.mediaDevices.getUserMedia.
 * Captures photos directly to a File/Blob without requiring the user to pick a saved file.
 *
 * @param {boolean} isOpen - Whether the camera modal is open
 * @param {function} onClose - Close handler
 * @param {function} onCapture - Callback receiving (file: File, previewUrl: string)
 * @param {string} title - Title of the capture modal (e.g. "Capture Before Photo")
 * @param {'environment' | 'user'} defaultFacingMode - 'environment' (back camera) or 'user' (front selfie)
 * @param {string} fileNamePrefix - Prefix for the generated image filename
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

  const [facingMode, setFacingMode] = useState(defaultFacingMode);
  const [capturedImage, setCapturedImage] = useState(null); // { blob, file, previewUrl }
  const [hasCameraPermission, setHasCameraPermission] = useState(null); // null = checking, true, false
  const [errorMessage, setErrorMessage] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);
  const [cameraDevices, setCameraDevices] = useState([]);

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
      // Find available video input devices
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === 'videoinput');
        setCameraDevices(videoInputs);
      } catch (_) {}

      const constraints = {
        audio: false,
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1920, min: 640 },
          height: { ideal: 1080, min: 480 },
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
      console.warn('[Camera] Failed to access camera with requested facingMode:', err);
      // Fallback try with simple video: true
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
        console.error('[Camera] Access denied or camera unavailable:', fallbackErr);
        setHasCameraPermission(false);
        if (fallbackErr.name === 'NotAllowedError' || fallbackErr.name === 'PermissionDeniedError') {
          setErrorMessage('Camera access was denied. Please allow camera permissions in your browser address bar.');
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

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 720;

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      // Mirror horizontally if using front user camera for natural selfie orientation
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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/90 text-white">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100">{title}</h3>
              <p className="text-[10px] text-slate-400">Live camera real-time capture</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Camera Viewfinder / Preview Container */}
        <div className="relative bg-black flex-1 flex items-center justify-center min-h-[340px] max-h-[500px] overflow-hidden">
          {/* Hidden Canvas for Frame Capture */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Captured Image Review State */}
          {capturedImage ? (
            <div className="relative w-full h-full flex items-center justify-center bg-black">
              <img
                src={capturedImage.previewUrl}
                alt="Captured Snapshot"
                className="max-h-[460px] w-full object-contain"
              />
              <div className="absolute top-3 left-3 bg-emerald-600/90 backdrop-blur text-white px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow">
                <Check className="w-3.5 h-3.5" />
                Snapshot Ready
              </div>
            </div>
          ) : hasCameraPermission === true ? (
            /* Live Camera Video Feed */
            <div className="relative w-full h-full flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover max-h-[460px] ${
                  facingMode === 'user' ? 'scale-x-[-1]' : ''
                }`}
              />

              {/* Viewfinder Target Overlay Guide */}
              <div className="absolute inset-8 border-2 border-white/30 rounded-xl pointer-events-none flex flex-col justify-between p-2">
                <div className="flex justify-between">
                  <div className="w-4 h-4 border-t-2 border-l-2 border-blue-400" />
                  <div className="w-4 h-4 border-t-2 border-r-2 border-blue-400" />
                </div>
                <div className="flex justify-between">
                  <div className="w-4 h-4 border-b-2 border-l-2 border-blue-400" />
                  <div className="w-4 h-4 border-b-2 border-r-2 border-blue-400" />
                </div>
              </div>

              {/* Live Badge */}
              <div className="absolute top-3 left-3 bg-red-600/90 backdrop-blur text-white px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1.5 shadow">
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                LIVE
              </div>

              {/* Camera Switch Button (if multiple cameras or on mobile) */}
              {cameraDevices.length > 1 && (
                <button
                  type="button"
                  onClick={handleToggleFacingMode}
                  className="absolute top-3 right-3 bg-slate-900/80 hover:bg-slate-900 text-white p-2 rounded-full border border-slate-700 shadow transition-colors"
                  title="Switch Camera (Front / Rear)"
                >
                  <SwitchCamera className="w-4 h-4" />
                </button>
              )}
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
              <span className="text-xs font-medium">Connecting to live camera...</span>
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
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 flex items-center justify-center gap-2 transition-colors active:scale-95"
              >
                <RefreshCw className="w-4 h-4" />
                Retake Photo
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2 transition-colors active:scale-95"
              >
                <Check className="w-4 h-4" />
                Use This Photo
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleTakeSnapshot}
                disabled={!hasCameraPermission || isCapturing}
                className="flex-1 py-3 px-5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-blue-900/40 flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <div className="w-4 h-4 rounded-full border-2 border-white flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                </div>
                <span>{isCapturing ? 'Capturing...' : 'Capture Photo'}</span>
              </button>

              {cameraDevices.length > 1 && (
                <button
                  type="button"
                  onClick={handleToggleFacingMode}
                  disabled={!hasCameraPermission}
                  className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                  title="Switch Camera"
                >
                  <SwitchCamera className="w-4 h-4" />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
