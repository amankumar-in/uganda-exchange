import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { Button, Skeleton, message, Alert } from 'antd';
import { CameraOutlined, ReloadOutlined, ArrowLeftOutlined, CheckOutlined, UploadOutlined } from '@ant-design/icons';
import { motion } from 'motion/react';
import OnboardingLayout from '@/components/onboarding/OnboardingLayout';
import { useAuth } from '@/context/AuthContext';
import { useOnboardingStyles } from '@/hooks/useOnboardingStyles';
import { fontWeights } from '@/theme/themeConfig';
import { getKycStatus, uploadSelfie, ApiError } from '@/services/api/onboarding';

type CameraState = 'idle' | 'requesting' | 'live' | 'captured' | 'unavailable';

export default function SelfiePage() {
  const router = useRouter();
  const { user } = useAuth();
  const s = useOnboardingStyles();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [pageLoading, setPageLoading] = useState(true);
  const [cameraState, setCameraState] = useState<CameraState>('idle');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Gate + cleanup
  useEffect(() => {
    if (!user) {
      router.push('/login?redirect=/onboarding/selfie');
      return;
    }
    (async () => {
      try {
        const status = await getKycStatus();
        if (status.status === 'APPROVED') { router.replace('/overview'); return; }
        if (status.status === 'REJECTED') { router.replace('/onboarding/status'); return; }
        if (!status.hasAddress) { router.replace('/onboarding/address'); return; }
        // Deliberately NOT auto-bouncing on hasSelfie. The user may have just
        // landed in a transient PENDING state and want to retake the photo
        // before we reach a terminal decision. Re-uploading overwrites the
        // selfie row — backend handles cleanup.
      } catch {
        // proceed
      } finally {
        setPageLoading(false);
      }
    })();

    return () => stopStream();
  }, [user, router]);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = async () => {
    setCameraError(null);
    setCameraState('requesting');
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera API not supported by this browser');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      // Transitioning to 'live' will mount the <video> element; the useEffect
      // below picks up the stream from streamRef and attaches it.
      setCameraState('live');
    } catch (err) {
      const msg = (err as Error).message || 'Could not access camera';
      setCameraError(msg);
      setCameraState('unavailable');
    }
  };

  // Attach the MediaStream to the <video> element AFTER it's rendered. Setting
  // srcObject inside startCamera fails because the element isn't in the DOM yet
  // when cameraState is still 'requesting'.
  useEffect(() => {
    if (cameraState !== 'live') return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    video.play().catch((err) => {
      // Autoplay might be blocked — surface the error so user can retry
      setCameraError(`Video playback failed: ${(err as Error).message}`);
      setCameraState('unavailable');
    });
  }, [cameraState]);

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const side = Math.min(video.videoWidth, video.videoHeight) || 480;
    canvas.width = side;
    canvas.height = side;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Mirror the image for natural self-view (matches live preview)
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    const sx = (video.videoWidth - side) / 2;
    const sy = (video.videoHeight - side) / 2;
    ctx.drawImage(video, sx, sy, side, side, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (b) => {
        if (!b) return;
        setBlob(b);
        setPreviewUrl(URL.createObjectURL(b));
        setCameraState('captured');
        stopStream();
      },
      'image/jpeg',
      0.9,
    );
  };

  const retake = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setBlob(null);
    startCamera();
  };

  const handleFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBlob(file);
    setPreviewUrl(URL.createObjectURL(file));
    setCameraState('captured');
  };

  const handleSubmit = async () => {
    if (!blob) return;
    setSubmitting(true);
    try {
      await uploadSelfie(blob, 'selfie.jpg');
      router.replace('/onboarding/status');
    } catch (err) {
      message.error((err as ApiError).message || 'Upload failed. Please try again.');
      setSubmitting(false);
    }
  };

  if (pageLoading) {
    return (
      <>
        <Head><title>Selfie · InTuition India</title></Head>
        <OnboardingLayout currentStep={5} title="Selfie" subtitle="Step 5 of 6">
          <Skeleton active paragraph={{ rows: 6 }} />
        </OnboardingLayout>
      </>
    );
  }

  const previewBoxSize = s.isMobile ? 260 : 320;

  return (
    <>
      <Head><title>Selfie · InTuition India</title></Head>
      <OnboardingLayout
        currentStep={5}
        title="Take a Selfie"
        subtitle="Centre your face, good lighting, no hat or glasses"
        showBack
        onBack={() => router.push('/onboarding/address')}
      >
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: s.token.marginLG, alignItems: 'center' }}>
            <div
              style={{
                width: previewBoxSize,
                height: previewBoxSize,
                borderRadius: '50%',
                overflow: 'hidden',
                background: 'rgba(0,0,0,0.35)',
                border: '3px solid rgba(255,255,255,0.3)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}
            >
              {previewUrl ? (
                <img src={previewUrl} alt="Selfie preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : cameraState === 'live' ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                />
              ) : (
                <CameraOutlined style={{ fontSize: 72, color: 'rgba(255,255,255,0.4)' }} />
              )}
            </div>
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {cameraError && cameraState === 'unavailable' && (
              <Alert
                type="warning"
                showIcon
                message="Couldn't open camera"
                description={`${cameraError}. You can upload a photo instead.`}
                style={{ width: '100%' }}
              />
            )}

            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: s.token.marginSM }}>
              {cameraState === 'idle' && (
                <Button type="primary" size="large" block onClick={startCamera} style={s.buttonCta}>
                  <CameraOutlined /> Start Camera
                </Button>
              )}
              {cameraState === 'requesting' && (
                <Button type="primary" size="large" block loading style={s.buttonCta}>
                  Requesting camera…
                </Button>
              )}
              {cameraState === 'live' && (
                <Button type="primary" size="large" block onClick={capture} style={s.buttonCta}>
                  <CameraOutlined /> Capture
                </Button>
              )}
              {cameraState === 'captured' && (
                <div style={{ display: 'flex', gap: s.token.marginSM }}>
                  <Button size="large" onClick={retake} disabled={submitting} style={{ ...s.buttonSecondary, flex: 1 }}>
                    <ReloadOutlined /> Retake
                  </Button>
                  <Button type="primary" size="large" loading={submitting} onClick={handleSubmit} style={{ ...s.buttonCta, flex: 2 }}>
                    <CheckOutlined /> Submit
                  </Button>
                </div>
              )}
              {cameraState === 'unavailable' && (
                <>
                  <Button size="large" block onClick={() => fileInputRef.current?.click()} style={s.buttonCta}>
                    <UploadOutlined /> Upload Photo
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="user"
                    onChange={handleFilePicked}
                    style={{ display: 'none' }}
                  />
                </>
              )}

              <Button size="large" block onClick={() => router.push('/onboarding/address')} style={s.buttonSecondary} disabled={submitting}>
                <ArrowLeftOutlined /> Back
              </Button>
            </div>

            <p style={{ ...s.hint, textAlign: 'center', fontWeight: fontWeights.medium, margin: 0 }}>
              🔒 Your selfie is encrypted at rest and never shared
            </p>
          </div>
        </motion.div>
      </OnboardingLayout>
    </>
  );
}
