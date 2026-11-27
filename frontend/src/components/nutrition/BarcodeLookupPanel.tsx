import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Camera, CameraOff, Plus, Search } from 'lucide-react';
import { ApiError } from '../../services/api';
import {
  foodService,
  nutritionService,
  type BarcodeLookupResponse,
} from '../../services/nutritionService';
import {
  isCameraSupported,
  startCameraBarcodeScan,
  type CameraScannerHandle,
} from '../../utils/barcodeScanner';

const BARCODE_FORMAT_REGEX = /^[A-Za-z0-9_-]{4,64}$/;

interface BarcodeLookupPanelProps {
  date: string;
  mealLabel: string;
  onLogged: () => Promise<void>;
  onFoodCached: () => Promise<void>;
  onDefineCustomFood: (barcode: string) => void;
  onClose: () => void;
}

const SOURCE_BADGES: Record<BarcodeLookupResponse['source'], { label: string; className: string }> =
  {
    local: {
      label: 'Yerel Önbellek',
      className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    },
    core: {
      label: 'Temel Besin',
      className: 'bg-elevated text-ink-secondary',
    },
    open_food_facts: {
      label: 'Open Food Facts · Kaydedildi',
      className: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
    },
    not_found: {
      label: 'Bulunamadı',
      className: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
    },
  };

export function BarcodeLookupPanel({
  date,
  mealLabel,
  onLogged,
  onFoodCached,
  onDefineCustomFood,
  onClose,
}: BarcodeLookupPanelProps) {
  const [codeInput, setCodeInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [result, setResult] = useState<BarcodeLookupResponse | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerRef = useRef<CameraScannerHandle | null>(null);

  const [quantityMode, setQuantityMode] = useState<'grams' | 'servings'>('grams');
  const [amount, setAmount] = useState('100');
  const [isLogging, setIsLogging] = useState(false);
  const [logFeedback, setLogFeedback] = useState<string | null>(null);

  const stopCamera = () => {
    scannerRef.current?.stop();
    scannerRef.current = null;
    setCameraActive(false);
  };

  useEffect(() => {
    return () => {
      scannerRef.current?.stop();
      scannerRef.current = null;
    };
  }, []);

  async function performLookup(rawCode: string) {
    const cleaned = rawCode.trim();
    setLookupError(null);
    setLogFeedback(null);

    if (!BARCODE_FORMAT_REGEX.test(cleaned)) {
      setLookupError(
        'Geçerli bir barkod veya QR kodu giriniz (4–64 karakter; harf, rakam, - veya _).',
      );
      return;
    }

    setCodeInput(cleaned);
    setIsSearching(true);
    try {
      const res = await foodService.lookupBarcode(cleaned);
      setResult(res);
      if (res.found && res.food) {
        setQuantityMode('grams');
        setAmount(String(res.food.servingGrams ?? 100));
        if (res.source === 'open_food_facts') {
          await onFoodCached();
        }
      }
    } catch (err) {
      setResult(null);
      setLookupError(err instanceof ApiError ? err.message : 'Barkod sorgusu başarısız oldu.');
    } finally {
      setIsSearching(false);
    }
  }

  async function handleStartCamera() {
    setCameraError(null);
    setLookupError(null);
    if (!isCameraSupported()) {
      setCameraError('Bu tarayıcı kamera erişimini desteklemiyor. Kodu elle girebilirsin.');
      return;
    }

    setCameraActive(true);
    window.requestAnimationFrame(async () => {
      const videoEl = videoRef.current;
      if (!videoEl) {
        setCameraActive(false);
        return;
      }
      scannerRef.current = await startCameraBarcodeScan(
        videoEl,
        (detectedCode) => {
          setCameraActive(false);
          scannerRef.current = null;
          void performLookup(detectedCode);
        },
        (message) => {
          setCameraActive(false);
          scannerRef.current = null;
          setCameraError(message);
        },
      );
    });
  }

  async function handleManualSubmit(e: FormEvent) {
    e.preventDefault();
    await performLookup(codeInput);
  }

  async function handleQuickLog() {
    if (!result?.found || !result.food) return;
    const numeric = Number(amount);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      setLookupError('Geçerli bir miktar giriniz.');
      return;
    }

    setIsLogging(true);
    setLookupError(null);
    setLogFeedback(null);
    try {
      await nutritionService.createLog({
        kind: 'food',
        date,
        mealLabel: mealLabel.trim() || null,
        foodId: result.food.id,
        quantityMode,
        ...(quantityMode === 'grams' ? { grams: numeric } : { servings: numeric }),
      });
      setLogFeedback(`${result.food.name} günlük kayda eklendi.`);
      await onLogged();
    } catch (err) {
      setLookupError(err instanceof ApiError ? err.message : 'Günlük kayda eklenemedi.');
    } finally {
      setIsLogging(false);
    }
  }

  const foundFood = result?.found ? result.food : null;
  const previewGrams =
    foundFood && Number(amount) > 0
      ? quantityMode === 'servings'
        ? Number(amount) * (foundFood.servingGrams ?? 100)
        : Number(amount)
      : 0;
  const previewKcal =
    foundFood && previewGrams > 0
      ? Math.round((foundFood.caloriesPer100g * previewGrams) / 100)
      : 0;

  return (
    <section aria-label="Barkod ve QR Okuyucu" className="space-y-4">
      {/* Kamera & Elle Giriş */}
      <div className="space-y-3">
        <div>
          {cameraActive ? (
            <button
              type="button"
              onClick={stopCamera}
              className="ft-btn-danger w-full py-2.5 text-sm"
            >
              <CameraOff className="h-4 w-4" aria-hidden="true" />
              <span>Kamerayı Durdur</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleStartCamera()}
              className="ft-btn-secondary w-full py-2.5 text-sm"
            >
              <Camera className="h-4 w-4 text-emerald-500" aria-hidden="true" />
              <span>Kamerayla Tara</span>
            </button>
          )}
        </div>

        <form onSubmit={handleManualSubmit} noValidate className="flex gap-2">
          <input
            aria-label="Barkod veya QR kodu"
            type="text"
            placeholder="Barkod veya QR kodunu elle gir (örn. 8690526012345)"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            className="ft-input flex-1 py-2"
          />
          <button
            type="submit"
            disabled={isSearching}
            className="ft-btn-primary shrink-0 py-2 text-xs"
          >
            <Search className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{isSearching ? 'Aranıyor...' : 'Kodu Ara'}</span>
          </button>
        </form>
      </div>

      {cameraActive && (
        <div className="overflow-hidden rounded-xl border border-line-strong bg-black">
          <video ref={videoRef} playsInline muted className="max-h-60 w-full object-cover" />
          <p className="bg-slate-950/90 px-3 py-1.5 text-center text-xs text-slate-300">
            Barkod veya QR kodunu kameraya yaklaştır...
          </p>
        </div>
      )}

      {cameraError && (
        <div role="status" className="ft-alert-warn text-xs">
          {cameraError}
        </div>
      )}

      {lookupError && (
        <div role="alert" className="ft-alert-error text-xs">
          {lookupError}
        </div>
      )}

      {logFeedback && (
        <div role="status" className="ft-alert-success text-xs">
          {logFeedback}
        </div>
      )}

      {/* Bulunan Ürün */}
      {foundFood && result && (
        <div className="ft-card-subtle space-y-3 border-emerald-500/35 p-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-ink">{foundFood.name}</h3>
              {foundFood.brand && <span className="text-xs text-ink-muted">· {foundFood.brand}</span>}
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${SOURCE_BADGES[result.source].className}`}
              >
                {SOURCE_BADGES[result.source].label}
              </span>
            </div>
            <p className="text-xs text-ink-muted">
              Kod: <span className="font-mono text-ink-secondary">{result.barcode}</span> · 100 g:{' '}
              <strong className="text-emerald-600 dark:text-emerald-400">
                {foundFood.caloriesPer100g} kcal
              </strong>{' '}
              · P: {foundFood.proteinPer100g}g · K: {foundFood.carbsPer100g}g · Y:{' '}
              {foundFood.fatPer100g}g
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Barkod miktar birimi"
              value={quantityMode}
              onChange={(e) => {
                const next = e.target.value as 'grams' | 'servings';
                setQuantityMode(next);
                setAmount(next === 'servings' ? '1' : String(foundFood.servingGrams ?? 100));
              }}
              className="ft-input-sm"
            >
              <option value="grams">Gram (g)</option>
              {foundFood.servingGrams && (
                <option value="servings">
                  Porsiyon ({foundFood.servingLabel ?? `${foundFood.servingGrams} g`})
                </option>
              )}
            </select>
            <input
              aria-label="Barkod ürün miktarı"
              type="number"
              step="0.1"
              min="0.1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="ft-input-sm w-24"
            />
            <button
              type="button"
              disabled={isLogging}
              onClick={() => void handleQuickLog()}
              className="ft-btn-primary py-2 text-xs"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                {isLogging
                  ? 'Ekleniyor...'
                  : `Günlük Kayda Ekle${previewKcal > 0 ? ` (${previewKcal} kcal)` : ''}`}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Bulunamayan Kod -> Özel Besine Tanımlama */}
      {result && !result.found && (
        <div className="ft-alert-warn space-y-3">
          <div>
            <p className="text-sm font-semibold">
              Bu kod sistemde bulunamadı: <span className="font-mono">{result.barcode}</span>
            </p>
            <p className="mt-0.5 text-xs opacity-90">
              {result.externalError ??
                'Bu barkodu veya QR kodunu kendi özel besinine tanımlayıp sonraki taramalarda tek tıkla kullanabilirsin.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onDefineCustomFood(result.barcode);
            }}
            className="ft-btn-primary text-xs"
          >
            Bu Kodla Yeni Besin Tanımla →
          </button>
        </div>
      )}

      <div className="flex justify-end border-t border-line pt-3">
        <button
          type="button"
          onClick={() => {
            stopCamera();
            onClose();
          }}
          className="ft-btn-ghost"
        >
          Kapat
        </button>
      </div>
    </section>
  );
}
