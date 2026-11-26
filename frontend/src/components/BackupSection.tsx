import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { ApiError } from '../services/api';
import {
  backupService,
  CSV_DATASET_OPTIONS,
  type BackupConflictStrategy,
  type BackupImportMode,
  type BackupImportResult,
  type CsvDataset,
} from '../services/backupService';

interface BackupSectionProps {
  onProfileRestored?: () => Promise<void> | void;
}

interface ParsedFilePreview {
  fileName: string;
  schemaVersion: unknown;
  exportedAt: string | null;
  totalRecords: number;
  rawBackup: unknown;
}

const MAX_CLIENT_FILE_BYTES = 5 * 1024 * 1024;

function readFileAsText(file: File): Promise<string> {
  if (typeof file.text === 'function') {
    return file.text();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Dosya okunamadı.'));
    reader.readAsText(file, 'utf-8');
  });
}

function summarizeBackupFile(fileName: string, parsed: unknown): ParsedFilePreview {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Seçilen dosya geçerli bir Fitness Tracker JSON yedeği değil.');
  }
  const obj = parsed as Record<string, unknown>;
  const data = obj.data && typeof obj.data === 'object' ? (obj.data as Record<string, unknown>) : null;
  if (!data) {
    throw new Error('Yedek dosyasında "data" bölümü bulunamadı.');
  }

  let totalRecords = 0;
  for (const value of Object.values(data)) {
    if (Array.isArray(value)) totalRecords += value.length;
  }

  return {
    fileName,
    schemaVersion: obj.schemaVersion,
    exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : null,
    totalRecords,
    rawBackup: parsed,
  };
}

export function BackupSection({ onProfileRestored }: BackupSectionProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [csvDataset, setCsvDataset] = useState<CsvDataset>('weights');
  const [isExportingJson, setIsExportingJson] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);

  const [parsedFile, setParsedFile] = useState<ParsedFilePreview | null>(null);
  const [importMode, setImportMode] = useState<BackupImportMode>('merge');
  const [conflictStrategy, setConflictStrategy] =
    useState<BackupConflictStrategy>('keep_existing');
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<BackupImportResult | null>(null);

  async function handleExportJson() {
    setError(null);
    setStatusMessage(null);
    setIsExportingJson(true);
    try {
      const filename = await backupService.downloadJson();
      setStatusMessage(`Tam JSON yedeğin indirildi (${filename}).`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'JSON yedek indirilemedi.');
    } finally {
      setIsExportingJson(false);
    }
  }

  async function handleExportCsv() {
    setError(null);
    setStatusMessage(null);
    setIsExportingCsv(true);
    try {
      const filename = await backupService.downloadCsv(csvDataset);
      setStatusMessage(`CSV tablosu indirildi (${filename}).`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'CSV dışa aktarma başarısız oldu.');
    } finally {
      setIsExportingCsv(false);
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setError(null);
    setStatusMessage(null);
    setImportResult(null);
    setConfirmOverwrite(false);

    const file = event.target.files?.[0];
    if (!file) {
      setParsedFile(null);
      return;
    }

    if (file.size > MAX_CLIENT_FILE_BYTES) {
      setParsedFile(null);
      setError('Yedek dosyası 5 MB sınırını aşıyor.');
      return;
    }

    try {
      const text = await readFileAsText(file);
      const parsed: unknown = JSON.parse(text);
      setParsedFile(summarizeBackupFile(file.name, parsed));
    } catch (err) {
      setParsedFile(null);
      setError(
        err instanceof SyntaxError
          ? 'Seçilen dosya geçerli bir JSON biçiminde değil.'
          : err instanceof Error
            ? err.message
            : 'Dosya okunamadı.',
      );
    }
  }

  async function handleImportSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatusMessage(null);
    setImportResult(null);

    if (!parsedFile) {
      setError('Lütfen önce bir JSON yedek dosyası seçin.');
      return;
    }
    if (importMode === 'overwrite' && !confirmOverwrite) {
      setError('Üzerine yazma işlemi için onay kutusunu işaretleyin.');
      return;
    }

    setIsImporting(true);
    try {
      const result = await backupService.importJson({
        mode: importMode,
        conflictStrategy,
        backup: parsedFile.rawBackup,
      });
      setImportResult(result);
      setStatusMessage(
        importMode === 'overwrite'
          ? 'Mevcut verilerin üzerine yedek başarıyla yüklendi.'
          : 'Yedek verileri hesabınla başarıyla birleştirildi.',
      );
      setParsedFile(null);
      setConfirmOverwrite(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      if (result.profileUpdated && onProfileRestored) {
        await onProfileRestored();
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Yedek geri yüklenemedi.');
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <section
      aria-labelledby="backup-section-title"
      className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900/60 p-6"
    >
      <div>
        <h2 id="backup-section-title" className="text-lg font-semibold text-white">
          Yedekleme & Veri Dışa Aktarma
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          Tüm kişisel verilerini tek JSON dosyasıyla yedekle, tablo inceleme için CSV indir veya
          daha önce aldığın yedeği güvenle geri yükle.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
        >
          {error}
        </div>
      )}

      {statusMessage && (
        <div
          role="status"
          className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300"
        >
          {statusMessage}
        </div>
      )}

      {/* Export Controls */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Tam JSON Yedek</h3>
            <p className="mt-1 text-xs text-slate-400">
              Profil hedefleri, kilo, özel besinler, tarifler, beslenme, antrenmanlar, şablonlar,
              kardiyo ve adım kayıtlarını tek dosyada indirir.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleExportJson()}
            disabled={isExportingJson}
            className="w-full rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:self-start"
          >
            {isExportingJson ? 'Hazırlanıyor...' : 'Tam JSON Yedek İndir'}
          </button>
        </div>

        <div className="flex flex-col justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Tablo Olarak İndir (CSV)</h3>
            <p className="mt-1 text-xs text-slate-400">
              Excel ve elektronik tablolarla uyumlu (Türkçe karakter destekli) ham kayıt tablosu.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="csv-dataset-select" className="sr-only">
              CSV veri seti
            </label>
            <select
              id="csv-dataset-select"
              value={csvDataset}
              onChange={(e) => setCsvDataset(e.target.value as CsvDataset)}
              className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
            >
              {CSV_DATASET_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void handleExportCsv()}
              disabled={isExportingCsv}
              className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-100 transition hover:border-emerald-500/60 hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isExportingCsv ? 'İndiriliyor...' : 'CSV İndir'}
            </button>
          </div>
        </div>
      </div>

      {/* JSON Restore Form */}
      <form
        onSubmit={handleImportSubmit}
        className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4"
      >
        <div>
          <h3 className="text-sm font-semibold text-white">JSON Yedekten Geri Yükle</h3>
          <p className="mt-1 text-xs text-slate-400">
            İşlem tek adımda (atomik) uygulanır; dosya hatalıysa mevcut hiçbir verin değişmez.
            Hazır besin ve egzersiz kütüphanesi korunur.
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="backup-file-input" className="block text-xs font-medium text-slate-300">
            JSON Yedek Dosyası (en fazla 5 MB)
          </label>
          <input
            ref={fileInputRef}
            id="backup-file-input"
            type="file"
            accept=".json,application/json"
            onChange={(e) => void handleFileChange(e)}
            className="block w-full cursor-pointer rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-slate-800 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-slate-200 hover:file:bg-slate-700"
          />
          {parsedFile && (
            <p className="text-xs text-emerald-300">
              Hazır: <span className="font-medium">{parsedFile.fileName}</span> · Şema v
              {String(parsedFile.schemaVersion ?? '?')} · {parsedFile.totalRecords} kayıt
            </p>
          )}
        </div>

        <fieldset className="space-y-2">
          <legend className="text-xs font-medium text-slate-300">Geri Yükleme Modu</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <label
              className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-xs transition ${
                importMode === 'merge'
                  ? 'border-emerald-500/60 bg-emerald-500/10 text-slate-100'
                  : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700'
              }`}
            >
              <input
                type="radio"
                name="backupImportMode"
                value="merge"
                checked={importMode === 'merge'}
                onChange={() => {
                  setImportMode('merge');
                  setConfirmOverwrite(false);
                }}
                className="mt-0.5 accent-emerald-500"
              />
              <span>
                <span className="block font-semibold text-white">Birleştir (Merge)</span>
                <span className="mt-0.5 block text-slate-400">
                  Mevcut kayıtlarını silmeden yedekteki kayıtları hesabına ekler.
                </span>
              </span>
            </label>

            <label
              className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-xs transition ${
                importMode === 'overwrite'
                  ? 'border-rose-500/60 bg-rose-500/10 text-slate-100'
                  : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700'
              }`}
            >
              <input
                type="radio"
                name="backupImportMode"
                value="overwrite"
                checked={importMode === 'overwrite'}
                onChange={() => setImportMode('overwrite')}
                className="mt-0.5 accent-rose-500"
              />
              <span>
                <span className="block font-semibold text-white">Üzerine Yaz (Overwrite)</span>
                <span className="mt-0.5 block text-slate-400">
                  Mevcut tüm kişisel kayıtlarını siler ve yalnızca bu yedeği yükler.
                </span>
              </span>
            </label>
          </div>
        </fieldset>

        {importMode === 'merge' && (
          <fieldset className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
            <legend className="px-1 text-xs font-medium text-slate-300">
              Aynı Kayıt Çakışırsa Ne Yapılsın?
            </legend>
            <div className="space-y-2">
              <label className="flex cursor-pointer items-start gap-2.5 text-xs text-slate-200">
                <input
                  type="radio"
                  name="backupConflictStrategy"
                  value="keep_existing"
                  checked={conflictStrategy === 'keep_existing'}
                  onChange={() => setConflictStrategy('keep_existing')}
                  className="mt-0.5 accent-emerald-500"
                />
                <span>
                  <span className="font-semibold text-white">Mevcut kayıtları koru</span>
                  <span className="block text-slate-400">
                    Aynı güne ait kilo/adım kaydın, aynı barkodlu özel besinin ve profil hedeflerin
                    değişmez; yalnızca hesapta eksik olan kayıtlar eklenir.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2.5 text-xs text-slate-200">
                <input
                  type="radio"
                  name="backupConflictStrategy"
                  value="prefer_backup"
                  checked={conflictStrategy === 'prefer_backup'}
                  onChange={() => setConflictStrategy('prefer_backup')}
                  className="mt-0.5 accent-emerald-500"
                />
                <span>
                  <span className="font-semibold text-white">Yedekteki kayıtları önceliklendir</span>
                  <span className="block text-slate-400">
                    Aynı güne ait kilo/adım kaydın, aynı barkodlu özel besinin ve profil hedeflerin
                    yedekteki değerlerle güncellenir; diğer günlerdeki mevcut verilerin korunur.
                  </span>
                </span>
              </label>
            </div>
          </fieldset>
        )}

        {importMode === 'overwrite' && (
          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200">
            <input
              type="checkbox"
              checked={confirmOverwrite}
              onChange={(e) => setConfirmOverwrite(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-rose-500"
            />
            <span>
              Mevcut tüm kişisel verilerimin silinip yalnızca seçili yedek dosyasının yüklenmesini
              onaylıyorum.
            </span>
          </label>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isImporting || !parsedFile || (importMode === 'overwrite' && !confirmOverwrite)}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
              importMode === 'overwrite'
                ? 'bg-rose-500 text-white hover:bg-rose-400'
                : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
            }`}
          >
            {isImporting
              ? 'Geri yükleniyor...'
              : importMode === 'overwrite'
                ? 'Mevcut Verilerin Üzerine Yaz'
                : 'Yedeği Birleştir'}
          </button>
        </div>

        {importResult && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-xs text-slate-300">
            <p className="font-semibold text-white">Geri Yükleme Özeti</p>
            <div className="mt-2 flex flex-wrap gap-3">
              <span className="rounded-md bg-emerald-500/15 px-2.5 py-1 text-emerald-300">
                Eklenen: {importResult.totals.imported}
              </span>
              <span className="rounded-md bg-sky-500/15 px-2.5 py-1 text-sky-300">
                Güncellenen: {importResult.totals.updated}
              </span>
              <span className="rounded-md bg-slate-700/60 px-2.5 py-1 text-slate-300">
                Korunan / Atlanan: {importResult.totals.skipped}
              </span>
              {importResult.profileUpdated && (
                <span className="rounded-md bg-amber-500/15 px-2.5 py-1 text-amber-300">
                  Profil hedefleri güncellendi
                </span>
              )}
            </div>
          </div>
        )}
      </form>
    </section>
  );
}
