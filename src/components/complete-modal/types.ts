/* =========================================================================
 * 타입 정의
 * ========================================================================= */

/** 공통 고객 정보 */
export interface CustomerInfo {
  company?: string;
  name?: string;
  phoneMasked?: string;
  emailDomain?: string;
}

/** 공통 링크 모음 */
export interface ReceiptLinks {
  receiptUrl?: string;
  teamUrl?: string;
  youtubeUrl?: string;
  guideUrl?: string;
}

/** 공통 액션 핸들러 */
export interface ReceiptActions {
  onCopyLink?: () => void;
  onBookMeeting?: () => void;
  onDownloadGuide?: () => void;
  onDownloadPDF?: () => void;
  onEmailReceipt?: () => void;
  onSaveImage?: () => void;
  onSavePDF?: () => void;
  onSendEmail?: () => void;
}

/** 공통 메타 정보 */
export interface ReceiptMeta {
  vatNote?: string;
}

/* =========================================================================
 * Seat(좌석) 타입 접수증
 * ========================================================================= */

export interface SeatLineItem {
  aptName: string;
  productName?: string;
  months?: number;
  baseMonthly?: number;
  monthlyAfter?: number;
  lineTotal?: number;
}

export interface SeatDetails {
  items: SeatLineItem[];
  monthlyTotalKRW?: number;
  periodTotalKRW?: number;
}

export interface SeatSummary {
  aptCount: number;
  monthlyTotalKRW?: number;
}

export interface ReceiptSeat {
  type: "seat";
  ticketCode: string;
  createdAtISO: string;
  customer?: CustomerInfo;
  summary: SeatSummary;
  details: SeatDetails;
  links?: ReceiptLinks;
  actions?: ReceiptActions;
  meta?: ReceiptMeta;
}

/* =========================================================================
 * Package(패키지) 타입 접수증
 * ========================================================================= */

export interface PackageArea {
  code: string;
  label: string;
}

export interface PackageDetails {
  areas?: PackageArea[];
}

export interface PackageSummary {
  scopeLabel?: string;
  areaCount?: number;
  budgetRangeText?: string;
}

export interface ReceiptPackage {
  type: "package";
  ticketCode: string;
  createdAtISO: string;
  customer?: CustomerInfo;
  summary: PackageSummary;
  details: PackageDetails;
  links?: ReceiptLinks;
  actions?: ReceiptActions;
  meta?: ReceiptMeta;
}

/* =========================================================================
 * 유니온 타입 & 가드
 * ========================================================================= */

export type ReceiptData = ReceiptSeat | ReceiptPackage;

export function isSeatReceipt(data: ReceiptData): data is ReceiptSeat {
  return data.type === "seat";
}

export function isPackageReceipt(data: ReceiptData): data is ReceiptPackage {
  return data.type === "package";
}

/* =========================================================================
 * 컴포넌트 Props
 * ========================================================================= */

export interface CompleteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
  data: ReceiptData;
  confirmLabel?: string;
}
