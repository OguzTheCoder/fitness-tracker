import { useEffect, useRef, useState, type FormEvent } from 'react';
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
      className: 'bg-emerald-500/15 text-emerald-300',
    },
    core: {
      label: 'Temel Besin',
      className: 'bg-slate-800 text-slate-200',
    },
    open_food_facts: {
      label: 'Open Food Facts · Kaydedildi',
      className: 'bg-sky-500/15 text-sky-300',
    },
    not_found: {
      label: 'Bulunamadı',
      className: 'bg-amber-500/15 text-amber-300',
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
    // Video elementi mount edildikten sonra başlat
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
    <section
      aria-label="Barkod ve QR Okuyucu"
      className="rounded-2xl border border-emerald-500/30 bg-slate-900/80 p-5 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-white">Barkod / QR ile Hızlı Ürün Bul</h2>
          <p className="text-xs text-slate-400">
            Önce yerel kütüphanende aranır; standart barkod yoksa Open Food Facts’ten tek seferlik
            çekilip kaydedilir.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            stopCamera();
            onClose();
          }}
          className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-300 transition hover:border-slate-500 hover:text-white"
        >
          Kapat
        </button>
      </div>

      {/* Kamera Kontrolü & Elle Giriş */}
      <div className="grid gap-3 md:grid-cols-[auto_1fr] md:items-end">
        <div>
          {cameraActive ? (
            <button
              type="button"
              onClick={stopCamera}
              className="w-full rounded-lg border border-rose-500/50 bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/20"
            >
              Kamerayı Durdur
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleStartCamera()}
              className="w-full rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-4 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/25"
            >
              Kamerayla Tara
            </button>
          )}
        </div>

        <form onSubmit={handleManualSubmit} noValidate className="flex flex-wrap gap-2">
          <input
            aria-label="Barkod veya QR kodu"
            type="text"
            placeholder="Barkod veya QR kodunu elle gir (örn. 8690526012345)"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            className="min-w-[220px] flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
          />
          <button
            type="submit"
            disabled={isSearching}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
          >
            {isSearching ? 'Aranıyor...' : 'Kodu Ara'}
          </button>
        </form>
      </div>

      {cameraActive && (
        <div className="overflow-hidden rounded-xl border border-slate-700 bg-black">
          <video
            ref={videoRef}
            playsInline
            muted
            className="max-h-60 w-full object-cover"
          />
          <p className="bg-slate-950/90 px-3 py-1.5 text-center text-xs text-slate-300">
            Barkod veya QR kodunu kameraya yaklaştır...
          </p>
        </div>
      )}

      {cameraError && (
        <div
          role="status"
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200"
        >
          {cameraError}
        </div>
      )}

      {lookupError && (
        <div
          role="alert"
          className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300"
        >
          {lookupError}
        </div>
      )}

      {logFeedback && (
        <div
          role="status"
          className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300"
        >
          {logFeedback}
        </div>
      )}

      {/* Bulunan Ürün */}
      {foundFood && result && (
        <div className="rounded-xl border border-emerald-500/30 bg-slate-950/70 p-4 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-white">{foundFood.name}</h3>
                {foundFood.brand && (
                  <span className="text-xs text-slate-400">· {foundFood.brand}</span>
                )}
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${SOURCE_BADGES[result.source].className}`}
                >
                  {SOURCE_BADGES[result.source].label}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Kod: <span className="font-mono text-slate-300">{result.barcode}</span> · 100 g:{' '}
                <strong className="text-emerald-400">{foundFood.caloriesPer100g} kcal</strong> · P:{' '}
                {foundFood.proteinPer100g}g · K: {foundFood.carbsPer100g}g · Y:{' '}
                {foundFood.fatPer100g}g
              </p>
            </div>
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
              className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white outline-none focus:border-emerald-400"
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
              className="w-24 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white outline-none focus:border-emerald-400"
            />
            <button
              type="button"
              disabled={isLogging}
              onClick={() => void handleQuickLog()}
              className="rounded-lg bg-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
            >
              {isLogging
                ? 'Ekleniyor...'
                : `Günlük Kayda Ekle${previewKcal > 0 ? ` (${previewKcal} kcal)` : ''}`}
            </button>
          </div>
        </div>
      )}

      {/* Bulunamayan Kod -> Özel Besine Tanımlama */}
      {result && !result.found && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-amber-200">
                Bu kod sistemde bulunamadı:{' '}
                <span className="font-mono text-white">{result.barcode}</span>
              </p>
              <p className="mt-0.5 text-xs text-amber-200/80">
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
              className="rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-slate-950 transition hover:bg-emerald-400"
            >
              Bu Kodla Yeni Besin Tanımla →
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
