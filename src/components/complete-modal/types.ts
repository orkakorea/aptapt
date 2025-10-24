/* =========================================================================
 * 완료(접수) 모달 · 공용 타입 (named export만 사용)
 * ========================================================================= */

export type InquiryKind = "SEAT" | "PACKAGE";
export type CurrencyCode = "KRW";

export type ReceiptLinks = {
  teamUrl?: string;
  youtubeUrl?: string;
  guideUrl?: string;
  receiptUrl?: string; // 비로그인 열람 토큰 URL
};

export type ReceiptActions = {
  onSaveImage?: () => void;
  onSavePDF?: () => void;
  onCopyLink?: () => void;
  onSendEmail?: () => void;
  onBookMeeting?: () => void;
  onViewQuote?: () => void;
  onDownloadGuide?: () => void;
};

export type ManagerInfo = {
  name?: string;
  phone?: string;
  avatarUrl?: string;
};

export type CustomerSnapshot = {
  company?: string;
  name?: string;
  phoneMasked?: string; // 마스킹된 값 권장
  emailDomain?: string; // @example.com
  campaignType?: string;
  inquiryKind?: string;
  note?: string;
};

/* === 요약(헤더/카드) === */

export type SeatSummary = {
  aptCount: number;
  topAptLabel: string;
  productLabel: string;
  months: number | null;
  monthlyTotalKRW: number | null;
  periodTotalKRW?: number | null;
};

export type PackageSummary = {
  scopeLabel: string;
  areaCount: number;
  months?: number | null;
  budgetRangeText?: string | null;
};

/* === 자세히 보기(테이블/리스트) === */

export type SeatItem = {
  aptName: string;
  productName?: string;
  months?: number | null;
  baseMonthly?: number | null; // 월 정가
  discountNote?: string | null; // 할인 요약
  monthlyAfter?: number | null; // 할인 후 월가
  lineTotal?: number | null; // 기간 합계
};

export type PackageArea = {
  code: string; // 행정코드 등
  label: string; // 표기 라벨
};

/* === 공통 메타 === */

export type ReceiptMeta = {
  currency?: CurrencyCode;
  vatNote?: string;
  timeZone?: string; // 기본 Asia/Seoul
};

/* === ReceiptData (유니온) === */

export type ReceiptBase = {
  ticketCode: string;
  createdAtISO: string;
  mode: InquiryKind;
  customer: CustomerSnapshot;
  manager?: ManagerInfo;
  links?: ReceiptLinks;
  actions?: ReceiptActions;
  meta?: ReceiptMeta;
};

export type ReceiptSeat = ReceiptBase & {
  mode: "SEAT";
  summary: SeatSummary;
  details: {
    items: SeatItem[];
    monthlyTotalKRW?: number | null;
    periodTotalKRW?: number | null;
  };
};

export type ReceiptPackage = ReceiptBase & {
  mode: "PACKAGE";
  summary: PackageSummary;
  details: {
    areas: PackageArea[];
  };
};

export type ReceiptData = ReceiptSeat | ReceiptPackage;

/* === 컴포넌트 공용 Props === */

export type CompleteModalProps = {
  open: boolean;
  onClose: () => void;
  data: ReceiptData;
  confirmLabel?: string; // 기본: 확인
};

/* === Type Guards === */

export function isSeatReceipt(data: ReceiptData): data is ReceiptSeat {
  return data.mode === "SEAT";
}

export function isPackageReceipt(data: ReceiptData): data is ReceiptPackage {
  return data.mode === "PACKAGE";
}
