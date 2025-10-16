import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Card, CardActions, CardContent, LinearProgress, Stack, Typography, Alert } from '@mui/material';
import { useCamera } from '../hooks/useCamera';
import { runLivenessSequence, supported } from '../utils/liveness';
import type { Challenge, LivenessResult } from '../utils/liveness';

export function LivenessCheck({ onResult }: { onResult: (r: LivenessResult) => void }) {
  const { videoRef, isReady, error, start, stop } = useCamera();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [running, setRunning] = useState(false);
  const [currentChallenge, setCurrentChallenge] = useState<Challenge | null>(null);
  const [progress, setProgress] = useState(0);

  // Removed automatic camera start - user will click to start

  useEffect(() => {
    let t: number | undefined;
    if (running) {
      setProgress(0);
      t = window.setInterval(() => setProgress((p) => Math.min(100, p + 3)), 100);
    } else {
      setProgress(0);
    }
    return () => clearInterval(t);
  }, [running]);

  const hint = useMemo(() => {
    switch (currentChallenge) {
      case 'prepare':
        return 'Posicione seu rosto dentro do quadro';
      case 'blink':
        return 'Pisca alguns vezes';
      case 'turn-left':
        return 'Vire levemente a cabeça para a esquerda';
      case 'turn-right':
        return 'Vire levemente a cabeça para a direita';
      default:
        return 'Aguardando...';
    }
  }, [currentChallenge]);

  async function handleStartCamera() {
    await start();
  }

  async function handleRun() {
    if (!videoRef.current || !canvasRef.current) return;
    setRunning(true);
    try {
      const result = await runLivenessSequence(videoRef.current, canvasRef.current, (c) => setCurrentChallenge(c));
      onResult(result);
    } finally {
      setRunning(false);
      setCurrentChallenge(null);
    }
  }

  return (
    <Card sx={{ maxWidth: 640, mx: 'auto' }}>
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h5">Prova de Vida</Typography>
          {!supported.faceDetector && (
            <Alert severity="info">Usando fallback simples (melhor com Chrome/Edge recentes).</Alert>
          )}
          {error && <Alert severity="error">{error}</Alert>}
          <Box sx={{ position: 'relative', width: '100%', aspectRatio: '4 / 3', bgcolor: 'black', borderRadius: 1, overflow: 'hidden' }}>
            <video ref={videoRef} playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </Box>
          {running && <LinearProgress variant="determinate" value={progress} />}
          <Typography variant="body2">{hint}</Typography>
        </Stack>
      </CardContent>
      <CardActions>
        {!isReady ? (
          <Button variant="contained" onClick={handleStartCamera} disabled={running}>
            Iniciar câmera
          </Button>
        ) : (
          <>
            <Button variant="contained" onClick={handleRun} disabled={running}>
              Iniciar verificação
            </Button>
            <Button onClick={stop} disabled={running}>Parar câmera</Button>
          </>
        )}
      </CardActions>
    </Card>
  );
}

export default LivenessCheck;


