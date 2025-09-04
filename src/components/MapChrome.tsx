// src/components/MapChrome.tsx
import React, { useEffect, useRef, useState } from "react";

/** ─────────────────────────────────────────────────────────
 * N열 매핑
 * N1 = 단지명, N2 = 상품명, N3 = 설치위치, N4 = 세대수, N5 = 거주인원
 * N6 = 모니터 수량, N7 = 월 송출횟수, N8 = 월 광고료, N9 = 1회 당 송출비용
 * N10 = 운영시간, N11 = 주소
 * ───────────────────────────────────────────────────────── */

export type SelectedApt = {
  name: string;                // N1
  productName?: string;        // N2
  installLocation?: string;    // N3
  households?: number;         // N4
  residents?: number;          // N5
  monitors?: number;           // N6
  monthlyImpressions?: number; // N7
  monthlyFee?: number;         // N8
  costPerPlay?: number;        // N9
  hours?: string;              // N10
  address?: string;            // N11

  // 추가
  monthlyFeeY1?: number;
  imageUrl?: string;
  lat: number;
  lng: number;
};

type Props = {
  selected?: SelectedApt | null;
  onCloseSelected?: () => void;
  onSearch?: (query: string) => void;
  initialQuery?: string;
};

/** 정적 에셋 베이스 */
const ASSET_BASE = (import.meta as any).env?.VITE_ASSET_BASE || "/products/";
const PLACEHOLDER = "/placeholder.svg";

/** 숫자/화폐 표기 */
const fmtNum = (n?: number, unit = "") =>
  typeof n === "number" && Number.isFinite(n) ? n.toLocaleString() + unit : "—";
const fmtWon = (n?: number) =>
  typeof n === "number" && Number.isFinite(n) ? n.toLocaleString() : "—";

/** 카카오 로드뷰 훅 */
function useRoadview(selected?: SelectedApt | null) {
  const roadviewRef = useRef<HTMLDivElement | null>(null);
  const [rvReady, setRvReady] = useState(false);
  const [rvErr, setRvErr] = useState<string | null>(null);

  useEffect(() => {
    setRvReady(false);
    setRvErr(null);
    const w = window as any;
    const kakao = w?.kakao;
    if (!selected || !kakao?.maps?.Roadview || !roadviewRef.current) return;

    const container = roadviewRef.current;
    container.innerHTML = "";

    const rv = new kakao.maps.Roadview(container);
    const rvClient = new kakao.maps.RoadviewClient();
    const pos = new kakao.maps.LatLng(selected.lat, selected.lng);

    const radii = [50, 100, 200, 400];
    let canceled = false;

    function tryFind(i: number) {
      if (canceled) return;
      if (i >= radii.length) {
        setRvReady(false);
        setRvErr("no pano");
        return;
      }
      rvClient.getNearestPanoId(pos, radii[i], (panoId: number | null) => {
        if (canceled) return;
        if (!panoId) return tryFind(i + 1);
        try {
          rv.setPanoId(panoId, pos);
          setRvReady(true);
          setTimeout(() => {
            try { rv.relayout(); } catch {}
          }, 0);
        } catch (e: any) {
          setRvReady(false);
          setRvErr(e?.message || "rv set failed");
        }
      });
    }
    tryFind(0);

    const onResize = () => { try { rv.relayout(); } catch {} };
    window.addEventListener("resize", onResize);
    return () => {
      canceled = true;
      window.removeEventListener("resize", onResize);
    };
  }, [selected?.lat, selected?.lng]);

  return { roadviewRef, rvReady, rvErr };
}

export default function MapChrome({ selected, onCloseSelected, onSearch, initialQuery }: Props) {
  const [query, setQuery] = useState(initialQuery || "");
  useEffect(() => setQuery(initialQuery || ""), [initialQuery]);

  const runSearch = () => {
    const q = query.trim();
    if (!q) return;
    onSearch?.(q);
  };

  const { roadviewRef, rvReady, rvErr } = useRoadview(selected);

  const fallbackImg =
    selected?.imageUrl ||
    PLACEHOLDER ||
    "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=1600&auto=format&fit=crop";

  const y1Fee = selected?.monthlyFeeY1 ?? selected?.monthlyFee;

  return (
    <>
      {/* 상단 바 */}
      <div className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-[#E5E7EB] z-[60] font-[Pretendard]">
        <div className="h-full flex items-center px-6">
          <div className="text-xl font-bold text-black">응답하라-입주민이여</div>
        </div>
      </div>

      {/* 1탭은 동일, 생략 */}

      {/* 2탭 (오른쪽) */}
      {selected && (
        <aside className="hidden md:block fixed top-16 bottom-0 left-[360px] w-[360px] z-[60] pointer-events-none font-[Pretendard]" data-tab="2">
          {/* overflow-y-auto 로 스크롤 가능 */}
          <div className="h-full px-6 py-5 pointer-events-auto overflow-y-auto">
            <div className="flex flex-col gap-4">
              {/* 썸네일 */}
              <div className="rounded-2xl overflow-hidden border border-[#E5E7EB] bg-[#F3F4F6]">
                <div className="relative w-full aspect-[4/3]">
                  <div ref={roadviewRef} className={`absolute inset-0 ${rvReady ? "" : "hidden"}`} aria-label="roadview" />
                  {!rvReady && (
                    <img src={fallbackImg} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  )}
                </div>
              </div>

              {/* 상세 카드 */}
              <div className="rounded-2xl border border-[#E5E7EB] bg-white">
                {/* 타이틀 + 닫기 */}
                <div className="px-4 pt-4 flex items-start justify-between">
                  <div className="flex-1 pr-3">
                    <div className="text-xl font-extrabold text-black truncate">
                      {selected.name || "N1"}
                    </div>
                    {/* N4/N5 메타 → 단지명 아래 배치 */}
                    <div className="mt-1 text-sm text-[#6B7280] whitespace-nowrap">
                      {fmtNum(selected.households, " 세대")} · 거주인원 {fmtNum(selected.residents, "명")}
                    </div>
                  </div>
                  <button
                    onClick={onCloseSelected}
                    className="ml-3 inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB]"
                    aria-label="닫기"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" fill="none">
                      <path d="M6 6L18 18M6 18L18 6" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>

                {/* 가격 */}
                <div className="px-4 pb-4">
                  <div className="h-12 rounded-xl bg-[#F3F4F6] flex items-center px-4">
                    <span className="text-[#6B7280] text-base">월 광고료</span>
                    <div className="ml-auto text-right">
                      <span className="text-black text-lg font-semibold">
                        {fmtWon(selected.monthlyFee)}
                      </span>
                      <span className="ml-1 text-[#111827] text-base">(VAT별도)</span>
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl border border-[#6C2DFF] bg-white">
                    <label className="flex items-center justify-between px-4 h-12 cursor-pointer">
                      <span className="flex items-center gap-2">
                        <input type="checkbox" className="accent-[#6C2DFF]" defaultChecked />
                        <span className="text-base font-medium text-[#6C2DFF]">
                          1년 계약 시 월 광고료
                        </span>
                      </span>
                      <span className="text-base font-bold text-[#6C2DFF]">
                        {fmtWon(y1Fee)} <span className="ml-1 font-medium">(VAT별도)</span>
                      </span>
                    </label>
                  </div>

                  <button className="mt-4 h-12 w-full rounded-xl bg-[#6C2DFF] text-white font-semibold">
                    아파트 담기
                  </button>
                </div>

                {/* 상세정보 */}
                <div className="h-px bg-[#E5E7EB]" />
                <div className="px-4 py-3 text-base font-semibold text-black">상세정보</div>
                <dl className="px-4 pb-4 text-base">
                  <Row label="상품명">
                    <span className="text-[#6C2DFF] font-semibold whitespace-normal break-words">
                      {selected.productName ?? "N2"}
                    </span>
                    <button className="ml-2 inline-flex h-8 px-3 rounded border border-[#E5E7EB] text-sm bg-white hover:bg-[#F9FAFB]">
                      상세보기
                    </button>
                  </Row>
                  <Row label="설치 위치">{selected.installLocation ?? "N3"}</Row>
                  <Row label="모니터 수량">{fmtNum(selected.monitors, " 대")}</Row>
                  <Row label="월 송출횟수">{fmtNum(selected.monthlyImpressions, " 회")}</Row>
                  {/* “원” 삭제 → 숫자만 */}
                  <Row label="월 광고료">{fmtWon(selected.monthlyFee)}</Row>
                  <Row label="1회 당 송출비용">{fmtWon(selected.costPerPlay)}</Row>
                  <Row label="운영 시간">{selected.hours ?? "N10"}</Row>
                  {/* 주소 풀네임 표시 */}
                  <Row label="주소">
                    <span className="whitespace-normal break-words">{selected.address ?? "N11"}</span>
                  </Row>
                </dl>
              </div>

              {!rvReady && rvErr && (
                <div className="text-xs text-[#9CA3AF] px-1">주변 로드뷰가 없어 준비된 이미지를 표시했습니다.</div>
              )}
            </div>
          </div>
        </aside>
      )}
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-[#E5E7EB] last:border-b-0">
      <dt className="text-[#111827] font-semibold">{label}</dt>
      {/* 말줄임 제거 + 여러줄 허용 */}
      <dd className="text-black text-right max-w-[58%] leading-6 whitespace-normal break-words">
        {children}
      </dd>
    </div>
  );
}
