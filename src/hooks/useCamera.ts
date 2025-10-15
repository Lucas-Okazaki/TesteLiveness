import { useCallback, useEffect, useRef, useState } from 'react';

export type UseCameraOptions = {
  videoConstraints?: MediaStreamConstraints['video'];
  audio?: boolean;
};

export function useCamera(options?: UseCameraOptions) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: options?.videoConstraints ?? { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: options?.audio ?? false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsReady(true);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Falha ao acessar a câmera';
      setError(message);
      setIsReady(false);
    }
  }, [options?.audio, options?.videoConstraints]);

  const stop = useCallback(() => {
    const stream = streamRef.current;
    stream?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setIsReady(false);
  }, []);

  useEffect(() => {
    return () => {
      // Cleanup when unmounting
      const stream = streamRef.current;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return { videoRef, isReady, error, start, stop } as const;
}


