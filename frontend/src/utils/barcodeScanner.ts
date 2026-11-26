interface NativeBarcodeResult {
  rawValue?: string;
}

interface NativeBarcodeDetector {
  detect(source: HTMLVideoElement): Promise<NativeBarcodeResult[]>;
}

type NativeBarcodeDetectorCtor = new (options?: {
  formats?: string[];
}) => NativeBarcodeDetector;

const SUPPORTED_FORMATS = [
  'ean_13',
  'ean_8',
  'upc_a',
  'upc_e',
  'code_128',
  'code_39',
  'qr_code',
];

function getNativeBarcodeDetector(): NativeBarcodeDetectorCtor | null {
  if (typeof window === 'undefined') return null;
  const candidate = (window as unknown as { BarcodeDetector?: NativeBarcodeDetectorCtor })
    .BarcodeDetector;
  return typeof candidate === 'function' ? candidate : null;
}

function formatCameraError(err: unknown): string {
  const name = err instanceof Error ? err.name : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Kamera izni verilmedi. Aşağıdan barkod veya QR kodunu elle girebilirsin.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'Cihazda kullanılabilir kamera bulunamadı. Kodu elle girebilirsin.';
  }
  return 'Kamera başlatılamadı. Kodu aşağıdan elle girebilirsin.';
}

export function isCameraSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function')
  );
}

export interface CameraScannerHandle {
  stop: () => void;
}

export async function startCameraBarcodeScan(
  videoEl: HTMLVideoElement,
  onDetect: (rawCode: string) => void,
  onError: (message: string) => void,
): Promise<CameraScannerHandle> {
  if (!isCameraSupported()) {
    onError('Bu tarayıcı kamera erişimini desteklemiyor. Kodu elle girebilirsin.');
    return { stop: () => undefined };
  }

  let stopped = false;
  let stream: MediaStream | null = null;
  let intervalId: number | null = null;
  let zxingStop: (() => void) | null = null;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (intervalId !== null) {
      window.clearInterval(intervalId);
      intervalId = null;
    }
    if (zxingStop) {
      try {
        zxingStop();
      } catch {
        // ignore teardown errors
      }
      zxingStop = null;
    }
    if (stream) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
      stream = null;
    }
    videoEl.srcObject = null;
  };

  const emitCode = (raw: string) => {
    const cleaned = raw.trim();
    if (!cleaned || stopped) return;
    stop();
    onDetect(cleaned);
  };

  const constraints: MediaStreamConstraints = {
    video: { facingMode: { ideal: 'environment' } },
    audio: false,
  };

  const NativeDetector = getNativeBarcodeDetector();
  if (NativeDetector) {
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (stopped) {
        stop();
        return { stop };
      }
      videoEl.srcObject = stream;
      await videoEl.play();

      const detector = new NativeDetector({ formats: SUPPORTED_FORMATS });
      intervalId = window.setInterval(async () => {
        if (stopped || videoEl.readyState < 2) return;
        try {
          const hits = await detector.detect(videoEl);
          const firstValue = hits.find((h) => typeof h.rawValue === 'string' && h.rawValue.trim())
            ?.rawValue;
          if (firstValue) emitCode(firstValue);
        } catch {
          // frame decode errors are non-fatal
        }
      }, 250);

      return { stop };
    } catch (err) {
      stop();
      onError(formatCameraError(err));
      return { stop };
    }
  }

  // Fallback: iOS Safari, Firefox vb. için @zxing/browser
  try {
    const { BrowserMultiFormatReader } = await import('@zxing/browser');
    if (stopped) return { stop };

    const reader = new BrowserMultiFormatReader();
    const controls = await reader.decodeFromConstraints(constraints, videoEl, (result) => {
      if (result) {
        emitCode(result.getText());
      }
    });

    if (stopped) {
      controls.stop();
      return { stop };
    }

    zxingStop = () => controls.stop();
    return { stop };
  } catch (err) {
    stop();
    onError(formatCameraError(err));
    return { stop };
  }
}
