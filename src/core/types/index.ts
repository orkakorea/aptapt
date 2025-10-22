/**
 * 공통 타입 정의 (PC·모바일 공용)
 * -------------------------------------------------------------
 * - React/Kakao/Supabase 등 런타임 의존성 없음.
 * - 도메인(아파트/카트/지도) 중심 타입만 모았습니다.
 */

/* =========================
 * 기본 좌표/바운드
 * ========================= */

/** 위도/경도 한 점 */
export type LatLng = {
  lat: number;
  lng: number;
};

/** 남서(SW) ↔ 북동(NE) 바운드 박스 */
export type Bounds = {
  sw: LatLng; // South-West
  ne: LatLng; // North-East
};

/* =========================
 * 데이터 행(아파트/상품)
 * ========================= */

/**
 * Supabase 테이블 한 행(원시 데이터)
 * - 프로젝트마다 컬럼명이 다를 수 있어 인덱스 시그니처를 허용합니다.
 */
export type PlaceRow = {
  id?: number | string;
  lat?: number | null;
  lng?: number | null;
  [key: string]: any; // 다양한 칼럼(예: 단지명, 상품명, 설치위치 등)
};

/* =========================
 * 지도 선택 정보(상세 패널)
 * ========================= */

export type SelectedApt = {
  rowKey: string; // buildRowKeyFromRow 결과
  rowId?: string; // DB id가 있으면 문자열로 보관
  name: string; // 단지명
  address?: string; // 주소(도로명/지번 등)
  productName?: string; // 상품명
  installLocation?: string; // 설치 위치
  households?: number; // 세대수
  residents?: number; // 거주 인원
  monitors?: number; // 모니터 수량
  monthlyImpressions?: number; // 월 송출 횟수
  costPerPlay?: number; // 1회 송출 비용
  hours?: string; // 운영 시간
  monthlyFee?: number; // 월 광고료(정가)
  monthlyFeeY1?: number; // 12개월 계약 월가(제공되는 경우)
  imageUrl?: string; // 썸네일/대표 이미지
  lat: number;
  lng: number;
};

/* =========================
 * 카트(견적용)
 * ========================= */

export type CartItem = {
  rowKey: string; // 동일 아파트·상품을 구분
  aptName: string; // 표시용 단지명
  productName?: string; // 상품명
  months: number; // 계약 개월(1~12)
  baseMonthly?: number; // 월 광고료(정가)
  monthlyFeeY1?: number; // 12개월 전용 월가(있으면)
};

/* =========================
 * 데이터 조회(선택)
 * ========================= */

/** 바운드 기반 조회 옵션(필드 제한/limit 포함) */
export type BoundsQueryOptions = {
  bounds: Bounds;
  /** 선택 필드(네트워크 절약용). 예: ["id","lat","lng","단지명","상품명"] */
  fields?: string[];
  /** 최대 행 수 제한(줌 레벨에 따라 조정) */
  limit?: number;
};

/* =========================
 * 편의/재노출(정책 계산 타입)
 * ========================= */

/**
 * 가격 계산 관련 타입을 함께 노출(런타임 의존성 없음).
 * - core/pricing 모듈의 타입만 type re-export 합니다.
 */
export type { CartPricingInput, CartPricingOutput, RangeRule, ProductRules, DiscountPolicy } from "../pricing";
