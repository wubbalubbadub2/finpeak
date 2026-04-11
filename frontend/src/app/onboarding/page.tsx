"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { uploadPDF, completeOnboarding, updateWallet, getWallets } from "@/lib/api";
import type { UploadResponse } from "@/lib/types";
import { Wallet, Upload, CheckCircle, ArrowRight, Sparkles, AlertCircle, Building2 } from "lucide-react";

const STEPS = [
  { id: 1, label: "Добро пожаловать", icon: Sparkles },
  { id: 2, label: "Загрузка выписки", icon: Upload },
  { id: 3, label: "Настройка счета", icon: Wallet },
  { id: 4, label: "Готово", icon: CheckCircle },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [walletName, setWalletName] = useState("");
  const [walletId, setWalletId] = useState<string | null>(null);
  const [openingBalance, setOpeningBalance] = useState("0");
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith(".pdf")) {
      setError("Принимаются только PDF файлы");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const res = await uploadPDF(file);
      setUploadResult(res);
      setWalletName(res.client_name || res.bank.toUpperCase());

      // Find the newly created wallet
      const wallets = await getWallets();
      const w = wallets.find(w => w.account_number === res.account_number);
      if (w) setWalletId(w.id);

      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setUploading(false);
    }
  }, []);

  const handleSaveWallet = async () => {
    if (!walletId) {
      setStep(4);
      return;
    }
    setSaving(true);
    try {
      await updateWallet(walletId, {
        wallet_name: walletName || "Основной счет",
        opening_balance: parseFloat(openingBalance) || 0,
      });
      setStep(4);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  const handleFinish = async () => {
    try {
      await completeOnboarding();
      router.push("/");
    } catch (e) {
      console.error(e);
      router.push("/");
    }
  };

  const handleSkip = async () => {
    try {
      await completeOnboarding();
      router.push("/");
    } catch (e) {
      console.error(e);
      router.push("/");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 px-4 py-12">
      <div className="max-w-3xl mx-auto">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex justify-between mb-3">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex flex-col items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                    s.id <= step
                      ? "bg-indigo-600 text-white"
                      : "bg-white border-2 border-gray-200 text-gray-400"
                  }`}
                >
                  <s.icon size={16} />
                </div>
                <p className={`text-xs mt-2 text-center ${s.id <= step ? "text-indigo-600 font-medium" : "text-gray-400"}`}>
                  {s.label}
                </p>
              </div>
            ))}
          </div>
          <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 transition-all duration-300"
              style={{ width: `${(step / STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Step content */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          {step === 1 && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Sparkles size={28} className="text-indigo-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2 tracking-tight">
                Добро пожаловать в Fin<span className="text-indigo-600">Peak</span>!
              </h1>
              <p className="text-gray-500 mb-2">Финансовая аналитика для малого бизнеса в Казахстане</p>
              <p className="text-sm text-gray-400 mb-8 max-w-md mx-auto">
                За пару минут мы настроим вашу систему: загрузим первую выписку, создадим счет и покажем дашборд.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8 max-w-2xl mx-auto">
                <Feature icon={<Upload size={16} />} title="Загрузка PDF" desc="Kaspi, Halyk, Jusan, ForteBank" />
                <Feature icon={<Sparkles size={16} />} title="AI категоризация" desc="97% операций автоматически" />
                <Feature icon={<Wallet size={16} />} title="Готовые отчеты" desc="ДДС, P&L, аналитика" />
              </div>
              <div className="flex justify-center gap-3">
                <button onClick={handleSkip} className="px-5 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700">
                  Пропустить
                </button>
                <button
                  onClick={() => setStep(2)}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  Начать <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="py-4">
              <h2 className="text-xl font-bold text-gray-800 mb-1">Загрузите банковскую выписку</h2>
              <p className="text-sm text-gray-500 mb-6">Скачайте выписку в формате PDF из вашего интернет-банка и загрузите её сюда</p>

              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  const f = e.dataTransfer.files[0];
                  if (f) handleFile(f);
                }}
                className={`rounded-xl border-2 border-dashed p-12 text-center transition-all ${
                  dragging ? "border-indigo-400 bg-indigo-50" : "border-gray-300 bg-gray-50"
                }`}
              >
                {uploading ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-gray-600">Обработка выписки...</p>
                    <p className="text-xs text-gray-400">Это займет 10-30 секунд</p>
                  </div>
                ) : (
                  <>
                    <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center mx-auto mb-4 border border-gray-200">
                      <Upload size={20} className="text-gray-400" />
                    </div>
                    <p className="text-base font-medium text-gray-700 mb-1">Перетащите PDF сюда</p>
                    <p className="text-sm text-gray-400 mb-4">или</p>
                    <label className="inline-flex items-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white cursor-pointer hover:bg-indigo-700">
                      Выбрать файл
                      <input type="file" accept=".pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                    </label>
                  </>
                )}
              </div>

              {error && (
                <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  <AlertCircle size={14} /> {error}
                </div>
              )}

              <div className="flex justify-between mt-6">
                <button onClick={() => setStep(1)} className="text-sm text-gray-500 hover:text-gray-700">← Назад</button>
                <button onClick={handleSkip} className="text-sm text-gray-500 hover:text-gray-700">Пропустить</button>
              </div>
            </div>
          )}

          {step === 3 && uploadResult && (
            <div className="py-4">
              <h2 className="text-xl font-bold text-gray-800 mb-1">Настройте счет</h2>
              <p className="text-sm text-gray-500 mb-6">Дайте удобное название счету и установите начальный остаток</p>

              {/* Result summary */}
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle size={16} className="text-emerald-600" />
                  <span className="text-sm font-semibold text-emerald-800">Выписка обработана</span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">Банк</p>
                    <p className="font-medium text-gray-800">{uploadResult.bank.toUpperCase()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Транзакций</p>
                    <p className="font-medium text-gray-800">{uploadResult.transaction_count}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Категоризировано</p>
                    <p className="font-medium text-gray-800">{Math.round((uploadResult.categorized_count / uploadResult.transaction_count) * 100)}%</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Название счета</label>
                  <div className="relative">
                    <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={walletName}
                      onChange={(e) => setWalletName(e.target.value)}
                      placeholder="Например: Kaspi основной"
                      className="w-full rounded-lg border border-gray-200 py-2.5 pl-9 pr-4 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Это название будет отображаться в отчетах</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Начальный остаток (₸)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={openingBalance}
                    onChange={(e) => setOpeningBalance(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-lg border border-gray-200 py-2.5 px-4 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                  />
                  <p className="text-xs text-gray-400 mt-1">Сумма на счете до начала периода выписки. Можно изменить позже.</p>
                </div>
              </div>

              {error && (
                <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  <AlertCircle size={14} /> {error}
                </div>
              )}

              <div className="flex justify-between mt-6">
                <button onClick={() => setStep(2)} className="text-sm text-gray-500 hover:text-gray-700">← Назад</button>
                <button
                  onClick={handleSaveWallet}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving ? "Сохранение..." : "Продолжить"} <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={28} className="text-emerald-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-800 mb-2">Всё готово!</h1>
              <p className="text-gray-500 mb-8 max-w-md mx-auto">
                Ваша система настроена. Теперь вы можете загружать новые выписки, смотреть отчеты и анализировать финансы.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8 max-w-2xl mx-auto text-left">
                <div className="rounded-xl border border-gray-200 p-4">
                  <p className="text-sm font-semibold text-gray-800 mb-1">📊 Дашборд</p>
                  <p className="text-xs text-gray-500">Главные показатели и тренды</p>
                </div>
                <div className="rounded-xl border border-gray-200 p-4">
                  <p className="text-sm font-semibold text-gray-800 mb-1">📈 Отчеты</p>
                  <p className="text-xs text-gray-500">ДДС, P&L, аналитика расходов</p>
                </div>
                <div className="rounded-xl border border-gray-200 p-4">
                  <p className="text-sm font-semibold text-gray-800 mb-1">✨ AI Прогноз</p>
                  <p className="text-xs text-gray-500">Аномалии и тренды</p>
                </div>
              </div>

              <button
                onClick={handleFinish}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Перейти на дашборд <ArrowRight size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-gray-200 p-4 text-left">
      <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 mb-2">{icon}</div>
      <p className="text-sm font-semibold text-gray-800">{title}</p>
      <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
    </div>
  );
}
