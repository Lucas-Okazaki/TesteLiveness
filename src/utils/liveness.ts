export type LivenessResult = {
  alive: boolean;
  reason?: string;
  steps: Array<{ name: string; passed: boolean; details?: string }>;
};

export type Challenge = 'prepare' | 'blink' | 'turn-left' | 'turn-right';

export const supported = {
  faceDetector: 'FaceDetector' in window,
};

export type FaceBox = { x: number; y: number; width: number; height: number };

export async function detectFaceBox(canvas: HTMLCanvasElement): Promise<FaceBox | null> {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  if (supported.faceDetector) {
    try {
      // @ts-expect-error FaceDetector is experimental
      const detector = new (window as any).FaceDetector({ fastMode: true });
      const bitmap = await createImageBitmap(canvas);
      const faces = await detector.detect(bitmap);
      if (faces?.[0]) {
        const box = faces[0].boundingBox;
        return { x: box.x, y: box.y, width: box.width, height: box.height };
      }
    } catch {
      // fall through to naive detection
    }
  }
  // Naive motion-based fallback: compare center brightness variance to edges
  const { width, height } = canvas;
  const image = ctx.getImageData(0, 0, width, height).data;
  const region = (x0: number, y0: number, w: number, h: number) => {
    let sum = 0;
    let sumSq = 0;
    let count = 0;
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        const i = (y * width + x) * 4;
        const r = image[i];
        const g = image[i + 1];
        const b = image[i + 2];
        const v = (r + g + b) / 3;
        sum += v;
        sumSq += v * v;
        count++;
      }
    }
    const mean = sum / count;
    const variance = sumSq / count - mean * mean;
    return { mean, variance };
  };
  const cx = Math.floor(width * 0.2);
  const cy = Math.floor(height * 0.2);
  const cw = Math.floor(width * 0.6);
  const ch = Math.floor(height * 0.6);
  const center = region(cx, cy, cw, ch);
  const edges = [
    region(0, 0, cx, height),
    region(cx + cw, 0, width - (cx + cw), height),
    region(0, 0, width, cy),
    region(0, cy + ch, width, height - (cy + ch)),
  ];
  const edgeVar = edges.reduce((a, e) => a + e.variance, 0) / edges.length;
  if (center.variance > edgeVar * 1.15) {
    return { x: cx, y: cy, width: cw, height: ch };
  }
  return null;
}

export async function captureToCanvas(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = video.videoWidth || 640;
  const h = video.videoHeight || 480;
  canvas.width = w;
  canvas.height = h;
  ctx.drawImage(video, 0, 0, w, h);
}

export async function runLivenessSequence(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  onChallenge?: (c: Challenge) => void
): Promise<LivenessResult> {
  const steps: LivenessResult['steps'] = [];

  async function wait(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async function waitForFacePresent(maxMs = 4000) {
    const start = Date.now();
    while (Date.now() - start < maxMs) {
      await captureToCanvas(video, canvas);
      const box = await detectFaceBox(canvas);
      if (box) return true;
      await wait(200);
    }
    return false;
  }

  async function checkMovement(direction: 'left' | 'right') {
    await captureToCanvas(video, canvas);
    const box1 = await detectFaceBox(canvas);
    await wait(700);
    await captureToCanvas(video, canvas);
    const box2 = await detectFaceBox(canvas);
    if (!box1 || !box2) return false;
    const dx = box2.x - box1.x;
    return direction === 'left' ? dx < -10 : dx > 10;
  }

  async function checkBlink() {
    // heuristic: detect face area change between two frames
    await captureToCanvas(video, canvas);
    const a = await detectFaceBox(canvas);
    await wait(200);
    await captureToCanvas(video, canvas);
    const b = await detectFaceBox(canvas);
    if (!a || !b) return false;
    const da = Math.abs(a.height - b.height) + Math.abs(a.width - b.width);
    return da > 6; // small threshold
  }

  // Preparation: ensure face is visible before starting
  onChallenge?.('prepare');
  const ready = await waitForFacePresent(5000);
  steps.push({ name: 'prepare', passed: ready });
  if (!ready) return { alive: false, reason: 'Rosto não detectado. Centralize seu rosto e tente novamente.', steps };

  const challenges: Challenge[] = ['blink', 'turn-left', 'turn-right'];

  for (const ch of challenges) {
    onChallenge?.(ch);
    let passed = false;
    const deadline = Date.now() + 5000; // give up to 5s per challenge
    while (!passed && Date.now() < deadline) {
      if (ch === 'blink') passed = await checkBlink();
      if (ch === 'turn-left') passed = await checkMovement('left');
      if (ch === 'turn-right') passed = await checkMovement('right');
      if (!passed) await wait(300);
    }
    steps.push({ name: ch, passed });
    if (!passed) return { alive: false, reason: `Falha no desafio: ${ch}`, steps };
  }

  return { alive: true, steps };
}


