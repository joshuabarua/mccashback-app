import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject, MutableRefObject } from 'react';
import { Platform } from 'react-native';
import type { Camera } from 'react-native-vision-camera';
import * as MediaLibrary from 'expo-media-library';

export function useRecording(params: {
  cameraRef: RefObject<Camera | null>;
  isActive: boolean;
  isConfiguring: boolean;
  showToast: (msg: string) => void;
  pendingResumeRef: MutableRefObject<boolean>;
  pendingFpsRef: MutableRefObject<number | null>;
  setFps: (v: number) => void;
  cameraFps: number | undefined;
  fps: number;
  cameraReadyRef: MutableRefObject<boolean>;
}) {
  const {
    cameraRef,
    isActive,
    isConfiguring,
    showToast,
    pendingResumeRef,
    pendingFpsRef,
    setFps,
    cameraFps,
    fps,
    cameraReadyRef,
  } = params;

  const [isRecording, setIsRecording] = useState(false);
  const resumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resumeRetryRef = useRef(false);
  const lastResumeAtRef = useRef(0);

  const saveToPhotos = useCallback(async (uri?: string) => {
    if (!uri) return;
    try {
      let perm = await MediaLibrary.getPermissionsAsync();
      if (!perm.granted) {
        perm = await MediaLibrary.requestPermissionsAsync({ writeOnly: true });
      }
      if (perm.granted) {
        await MediaLibrary.saveToLibraryAsync(uri);
        showToast('Saved to Photos');
      } else {
        showToast('Allow Photos permission to save');
      }
    } catch (e) {
      console.error('Failed to save to Photos:', e);
      showToast('Failed to save to Photos');
    }
  }, [showToast]);

  useEffect(() => {
    return () => {
      if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
  }, []);

  const startRecording = useCallback(() => {
    const cam = cameraRef.current;
    if (!cam || isRecording || isConfiguring || !isActive) return;
    try {
      setIsRecording(true);
      cam.startRecording({
        fileType: Platform.OS === 'ios' ? 'mov' : 'mp4',
        onRecordingFinished: (video: any) => {
          setIsRecording(false);
          if (pendingFpsRef.current != null) {
            const next = pendingFpsRef.current;
            pendingFpsRef.current = null;
            setFps(next);
          } else {
            pendingResumeRef.current = false;
          }
          resumeRetryRef.current = false;
          let uri = (video && (video.path || video.filePath || video.uri)) as string | undefined;
          if (uri && !uri.startsWith('file://')) uri = `file://${uri}`;
          console.log('Recording finished:', uri || video);
          // Fire and forget save; callback cannot be async
          void saveToPhotos(uri);
        },
        onRecordingError: (error: any) => {
          setIsRecording(false);
          if (pendingFpsRef.current != null) {
            const next = pendingFpsRef.current;
            pendingFpsRef.current = null;
            setFps(next);
          }
          const errStr = String((error && (error.message || error.toString?.())) || error);
          const errCode = (error && (error.code ?? error.errorCode ?? error.nativeErrorCode)) as number | undefined;
          const isKnownAv = errStr.includes('-11800') || errStr.includes('-12780') || errCode === -11800 || errCode === -12780;
          const withinResume = resumeRetryRef.current && Date.now() - lastResumeAtRef.current < 4000;
          if (isKnownAv && withinResume) {
            console.warn('Resume failed with AV error, scheduling one-time retry');
            resumeRetryRef.current = false;
            if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
            retryTimeoutRef.current = setTimeout(() => {
              if (!isRecording && !isConfiguring && isActive) {
                showToast('Retrying resume…');
                startRecording();
              }
            }, 800);
          } else {
            resumeRetryRef.current = false;
            pendingResumeRef.current = false;
            showToast('Recording error');
            console.error('Recording error:', error);
          }
        },
      } as any);
    } catch (e) {
      setIsRecording(false);
      console.error('Failed to start recording:', e);
    }
  }, [cameraRef, isRecording, isConfiguring, isActive, showToast, pendingFpsRef, pendingResumeRef, setFps, saveToPhotos]);

  const stopRecording = useCallback(() => {
    const cam = cameraRef.current;
    if (!cam || !isRecording) return;
    try {
      cam.stopRecording();
    } catch (e) {
      console.error('Failed to stop recording:', e);
    }
  }, [cameraRef, isRecording]);

  // When configuration settles AND camera signals initialized, resume recording if needed
  useEffect(() => {
    if (!isConfiguring && pendingResumeRef.current && !isRecording) {
      if (!cameraReadyRef.current) return;
      const delay = Platform.OS === 'ios' && fps === 30 ? 1200 : 0;
      if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
      resumeTimeoutRef.current = setTimeout(() => {
        console.log('Resuming recording after settle. fps:', fps, 'cameraFps:', cameraFps);
        pendingResumeRef.current = false;
        lastResumeAtRef.current = Date.now();
        resumeRetryRef.current = true;
        showToast('Resumed recording');
        startRecording();
      }, delay);
    }
  }, [isConfiguring, isRecording, startRecording, showToast, fps, cameraFps, pendingResumeRef, cameraReadyRef]);

  return { isRecording, startRecording, stopRecording };
}
