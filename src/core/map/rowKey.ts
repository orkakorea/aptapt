// src/core/map/rowKey.ts

/**
 * RowKey / GroupKey 규칙 (PC·모바일 공통)
 * -------------------------------------------------------------
 * - React, Kakao, Supabase 의존성 없음.
 * - 지도 마커/카트에서 동일한 기준으로 키를 만들기 위한 모듈입니다.
 */

import { getField, toNumLoose } from "../utils"; // 공용 유틸

/** 소수점 자릿수(위경도 키 생성 시 사용) */
export const LAT_LNG_PRECISION = 7;

/**
 * 같은 좌표에 찍힌 마커들을 묶기 위한 그룹 키
 * - 위/경도를 동일 자릿수로 반올림해서 문자열로 만듭니다.
 * - 값이 비정상(NaN)일 경우 0으로 처리합니다.
 */
export function groupKeyFromRow(row: Record<string, any>): string {
  const lat = Number(row?.lat);
  const lng = Number(row?.lng);
  const latN = Number.isFinite(lat) ? lat : 0;
  const lngN = Number.isFinite(lng) ? lng : 0;
  return `${latN.toFixed(LAT_LNG_PRECISION)},${lngN.toFixed(LAT_LNG_PRECISION)}`;
}

/**
 * 한 행(아파트+상품) 고유 식별 키
 * - 원칙: DB의 `id`(또는 공개 뷰의 `place_id`)가 있으면 최우선 사용
 * - 없을 때: 좌표 + 상품명 + 설치위치 조합으로 생성
 *
 * 예시:
 *  - `id:12345`
 *  - `xy:37.1234567,127.1234567|p:ELEVATOR TV|loc:EV 내부`
 */
export function buildRowKeyFromRow(row: Record<string, any>): string {
  // 공개 뷰 호환: place_id도 인식
  const idPart = row?.id != null ? String(row.id) : row?.place_id != null ? String(row.place_id) : "";

  // 좌표
  const lat = Number(row?.lat);
  const lng = Number(row?.lng);
  const latN = Number.isFinite(lat) ? lat : 0;
  const lngN = Number.isFinite(lng) ? lng : 0;

  // 상품명/설치위치 — 다양한 필드명 케이터 (snake_case 포함)
  const productName = String(getField(row, ["상품명", "productName", "product_name"]) ?? "");
  const installLocation = String(getField(row, ["설치위치", "installLocation", "install_location"]) ?? "");

  if (idPart) return `id:${idPart}`;
  return `xy:${latN.toFixed(LAT_LNG_PRECISION)},${lngN.toFixed(
    LAT_LNG_PRECISION,
  )}|p:${productName}|loc:${installLocation}`;
}

/**
 * 행에서 월 광고료(정가)를 숫자로 추출
 * - 허용 키: ["월광고료", "month_fee", "monthly_fee", "monthlyFee"]
 * - 파싱 실패 시 0
 */
export function monthlyFeeOf(row: Record<string, any>): number {
  return toNumLoose(getField(row, ["월광고료", "month_fee", "monthly_fee", "monthlyFee"])) ?? 0;
}
