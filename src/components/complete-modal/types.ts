/* =========================================================================
 * 완료(접수) 모달 · 공용 타입
 * - PC/모바일 컴포넌트가 공통으로 사용하는 데이터 구조를 정의합니다.
 * - 문의 경로는 2종: "SEAT"(구좌/T.O) | "PACKAGE"(시군구·동 단위 패키지)
 * - 개인정보는 접수증 이미지/PDF에서 부분 마스킹(전화 뒤 4자리, 이메일 도메인만) 권장
 * - Admin 고정 매핑(참고): inquiry_kind, company, campaign_type, customer_name,
 *   phone, email, name→note, status, apt_name, product_name
 * ========================================================================= */

export type InquiryKind = "SEAT" | "PACKAGE";

/** 통화는 KRW만 사용(확장 대비 문자열 유니온 유지) */
export type CurrencyCode = "KRW";

/** 모달 외부로 노출할 브랜드/가이드/접수증 링크 모음 */
export type ReceiptLinks = {
  /** 팀/회사 소개(오르카의 얼굴들) */
  teamUrl?: string;
  /** 영상소재 템플릿(YouTube 재생목록) */
  youtubeUrl?: string;
  /** 제작 가이드(페이지 또는 PDF) */
  guideUrl?: string;
  /** 비로그인 열람용 접수증 링크(토큰 URL) */
  receiptUrl?: string;
};

/** 모달 안에서 트리거되는 액션 콜백(선택 구현) */
export type ReceiptActions = {
  /** 접수증을 이미지(PNG)로 저장 */
  onSaveImage?: () => void;
  /** 접수증을 PDF로 저장 */
  onSavePDF?: () => void;
  /** 접수증 링크(토큰 URL) 복사 */
  onCopyLink?: () => void;
  /** 접수증을 이메일로 발송 */
  onSendEmail?: () => void;
  /** 상담 일정 예약(캘린더/콜 등) */
  onBookMeeting?: () => void;
  /** 견적 상세 보기(카트/견적 패널 열기 등) */
  onViewQuote?: () => void;
  /** 제작 가이드 다운로드/열기 */
  onDownloadGuide?: () => void;
};

/** 담당 매니저(배정 예정 또는 가상 표시) */
export type ManagerInfo = {
  name?: string;
  phone?: string;
  avatarUrl?: string;
};

/** 고객 정보 스냅샷(접수 시점 저장) — 이미지/PDF엔 부분 마스킹 권장 */
export type CustomerSnapshot = {
  /** 상호/브랜드명 */
  company?: string;
  /** 담당자명 */
  name?: string;
  /** 연락처(마스킹 적용 값 권장, 예: 010-****-1234 또는 끝 4자리만 표시) */
  phoneMasked?: string;
  /** 이메일 도메인만(예: @example.com) */
  emailDomain?: string;
  /** 캠페인 유형(기업/공공/병원/소상공인/광고대행사 등) */
  campaignType?: string;
  /** 유입 경로(광고/검색/소개 등) */
  inquiryKind?: string;
  /** 요청사항(최대 N줄 UI 제한 권장) */
  note?: string;
};

/* =========================
 * 요약(헤더/카드 영역)
 * ========================= */

/** SEAT(구좌) 요약 — 1탭 총액과 정합 일치 권장 */
export type SeatSummary = {
  /** 담은 단지 수 */
  aptCount: number;
  /** 대표 단지 라벨: "A아파트 외 n개" */
  topAptLabel: string;
  /** 상품 요약: "Elevator TV 외" */
  productLabel: string;
  /** 광고 기간(개월). 여러 값이면 최댓값 + "등"은 UI에서 처리 */
  months: number | null;
  /** 월 예상 합계(부가세 별도) */
  monthlyTotalKRW: number | null;
  /** 기간 총액(월예상×개월, 부가세 별도) */
  periodTotalKRW?: number | null;
};

/** PACKAGE(패키지) 요약 — 총액 즉시 확정 불가 시 텍스트로 대체 */
export type PackageSummary = {
  /** 범위 라벨: "서울 강남구 · 동 3개" 등 */
  scopeLabel: string;
  /** 선택 영역 수(구/동 등) */
  areaCount: number;
  /** 희망 기간(개월, 선택) */
  months?: number | null;
  /** 예산 범위 텍스트(예: "~ 500만원/월") */
  budgetRangeText?: string | null;
};

/* =========================
 * 자세히 보기(테이블/리스트)
 * ========================= */

/** SEAT 라인아이템(단지별) */
export type SeatItem = {
  aptName: string;
  productName?: string;
  months?: number | null;
  /** 월 정가 */
  baseMonthly?: number | null;
  /** 적용 할인 요약(기간/사전보상/프로모션 등) */
  discountNote?: string | null;
  /** 할인 적용 후 월가 */
  monthlyAfter?: number | null;
  /** 기간 합계(월가×개월) */
  lineTotal?: number | null;
};

/** PACKAGE 영역 단위(행정코드/라벨) */
export type PackageArea = {
  /** 행정구역 코드(시/군/구/동 등 외부 식별자) */
  code: string;
  /** 표시 라벨(예: "서울 강남구 역삼1동") */
  label: string;
};

/* =========================
 * 접수증 공통 메타
 * ========================= */

export type ReceiptMeta = {
  /** 통화(기본 KRW) */
  currency?: CurrencyCode;
  /** VAT 고지 문구(예: "부가세 별도") */
  vatNote?: string;
  /** 시간대 표기(기본: "Asia/Seoul") */
  timeZone?: string;
};

/* =========================
 * ReceiptData (분기 유니온)
 * ========================= */

export type ReceiptBase = {
  /** 접수 번호(예: ORKA-YYYYMMDD-####) */
  ticketCode: string;
  /** ISO 문자열(저장 시점). UI에선 KST로 포맷하여 표시 */
  createdAtISO: string;
  /** 문의 경로 */
  mode: InquiryKind;
  /** 고객 정보 스냅샷 */
  customer: CustomerSnapshot;
  /** 담당 매니저(선택) */
  manager?: ManagerInfo;
  /** 링크 모음(팀/가이드/접수증 등) */
  links?: ReceiptLinks;
  /** 액션 콜백 */
  actions?: ReceiptActions;
  /** 통화/시간대/VAT 고지 등 메타 */
  meta?: ReceiptMeta;
};

export type ReceiptSeat = ReceiptBase & {
  mode: "SEAT";
  /** 상단 요약 카드 */
  summary: SeatSummary;
  /** 자세히 보기 테이블 데이터 */
  details: {
    items: SeatItem[];
    /** 재확인용 합계(요약과 일치하도록 유지) */
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

/** 완료 모달에 주입하는 단일 데이터 구조 */
export type ReceiptData = ReceiptSeat | ReceiptPackage;

/* =========================
 * 컴포넌트 공용 Props
 * ========================= */

/** PC/모바일 완료 모달 공용 Props */
export type CompleteModalProps = {
  open: boolean;
  onClose: () => void;
  data: ReceiptData;
  /** 하단 확인 버튼 라벨(기본: "확인") */
  confirmLabel?: string;
};

/* =========================
 * Type Guards
 * ========================= */

/** data가 SEAT(구좌) 모드인지 확인 */
export function isSeatReceipt(data: ReceiptData): data is ReceiptSeat {
  return data.mode === "SEAT";
}

/** data가 PACKAGE(패키지) 모드인지 확인 */
export function isPackageReceipt(data: ReceiptData): data is ReceiptPackage {
  return data.mode === "PACKAGE";
}
