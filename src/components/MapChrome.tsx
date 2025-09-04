// src/components/MapChrome.tsx
import React, { useEffect, useMemo, useState } from "react";

/** DB에서 선택된 행을 MapPage가 넘겨주는 타입 (N-매핑 주석 참고) */
export type SelectedApt = {
  // N1
  name: string | null | undefined;              // 단지명
  // N2
  productName?: string | null;                  // 상품명
  // N4~N11
  households?: number | null;                   // 세대수
  residents?: number | null;                    // 거주인원
  monitors?: number | null;                     // 모니터수량
  monthlyImpressions?: number | null;           // 월 송출횟수
  monthlyFee?: number | null;                   // 월 광고료 (VAT 별도)
  monthlyFeeY1?: number | null;                 // 1년 계약 시 월 광고료 (VAT 별도)
  perPlayCost?: number | null;                  // 1회당 송출비용
  hours?: string | null;                        // 운영시간
  address?: string | null;                      // 주소
  // 기타
  imageUrl?: string | null;                     // 썸네일(없으면 플레이스홀더)
  lat: number;
  lng: number;
};

type Props = {
  selected: SelectedApt | null;
  onCloseSelected: () => void;
  onSearch: (q: string) => void;
  initialQuery?: string;
};

function fmtNum(n?: number | null, unit?: string) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const s = n.toLocaleString("ko-KR");
  return unit ? `${s} ${unit}` : s;
}
function fmtWon(n?: number | null) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${n.toLocaleString("ko-KR")} 원`;
}

export default function MapChrome({ selected, onCloseSelected, onSearch, initialQuery }: Props) {
  const [useAnnual, setUseAnnual] = useState(true);

  useEffect(() => {
    // 선택 변경 시: 1년가가 있으면 기본 선택, 없으면 일반가
    setUseAnnual(Boolean(selected?.monthlyFeeY1));
  }, [selected]);

  const activePriceText = useMemo(() => {
    const n = (useAnnual ? selected?.monthlyFeeY1 : selected?.monthlyFee) ?? null;
    return fmtWon(n);
  }, [useAnnual, selected?.monthlyFee, selected?.monthlyFeeY1]);

  // 좌측 고정 패널 (MapPage가 지도 left를 360/720으로 밀어줌)
  return (
    <aside className="fixed top-16 left-0 bottom-0 z-[20] w-full md:w-[720px] bg-white border-r border-neutral-200 overflow-y-auto">
      {/* 검색바 (옵션) */}
      <div className="px-4 pt-3 pb-2 border-b border-neutral-100 flex gap-2">
        <input
          defaultValue={initialQuery}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSearch((e.target as HTMLInputElement).value);
          }}
          placeholder="지역/아파트 검색"
          className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-violet-500"
        />
        <button
          onClick={() => {
            const el = document.querySelector<HTMLInputElement>("aside input");
            onSearch(el?.value || "");
          }}
          className="px-3 py-2 text-sm rounded-lg bg-violet-600 text-white"
        >
          검색
        </button>
      </div>

      {/* 선택 상세 */}
      {selected ? (
        <div className="px-5 py-5 space-y-16">
          {/* 헤더 + 미디어 */}
          <section>
            <div className="relative w-full aspect-[16/9] rounded-xl overflow-hidden bg-neutral-100">
              {selected.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selected.imageUrl}
                  alt={selected.name ?? ""}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-neutral-100" />
              )}
              <button
                onClick={onCloseSelected}
                className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 shadow flex items-center justify-center text-neutral-700 hover:bg-white"
                aria-label="close"
                title="닫기"
              >
                ×
              </button>
            </div>

            <div className="mt-4">
              {/* N1 단지명 */}
              <h1 className="text-2xl font-extrabold tracking-tight">
                {selected.name ?? "—"}
              </h1>
              {/* N4 · N5 */}
              <p className="mt-1 text-neutral-500">
                {fmtNum(selected.households, "세대")} · 거주인원 {fmtNum(selected.residents, "명")}
              </p>
            </div>

            {/* 가격 카드 */}
            <div className="mt-6 rounded-xl border border-neutral-200 overflow-hidden">
              {/* 일반 월 광고료 (비활성 스타일) */}
              <div className="px-4 py-4 bg-neutral-50 flex items-center justify-between">
                <div className="text-neutral-600">월 광고료</div>
                <div className="text-neutral-500">{fmtWon(selected.monthlyFee)} <span className="text-neutral-400">(VAT별도)</span></div>
              </div>
              {/* 1년 계약 시 월 광고료 (선택 가능) */}
              <label className="px-4 py-4 flex items-center justify-between gap-3 border-t border-neutral-200 cursor-pointer">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={useAnnual}
                    onChange={(e) => setUseAnnual(e.target.checked)}
                    className="w-4 h-4 accent-violet-600"
                  />
                  <span className="font-medium">1년 계약 시 월 광고료</span>
                </div>
                <div className="text-violet-600 font-semibold">
                  {fmtWon(selected.monthlyFeeY1)} <span className="text-neutral-400 font-normal">(VAT별도)</span>
                </div>
              </label>

              {/* 담기 버튼 */}
              <div className="px-4 pb-4">
                <button
                  className="mt-3 w-full h-12 rounded-xl bg-violet-600 text-white font-semibold hover:bg-violet-700 transition"
                  onClick={() => {
                    // 필요한 액션이 있으면 여기서 처리
                    console.log("담기:", { selected, useAnnual, price: activePriceText });
                  }}
                >
                  아파트 담기
                </button>
              </div>
            </div>
          </section>

          {/* 상세정보 */}
          <section>
            <h2 className="text-lg font-bold mb-3">상세정보</h2>
            <div className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 overflow-hidden">
              {/* N2 상품명 */}
              <div className="px-4 py-3 flex items-center justify-between">
                <div className="text-neutral-500">상품명</div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-violet-600 max-w-[220px] truncate">{selected.productName ?? "—"}</span>
                  <button className="px-3 py-1.5 text-sm rounded-md border border-neutral-300 hover:bg-neutral-50">
                    상세보기
                  </button>
                </div>
              </div>

              {/* N6 모니터 수량 */}
              <div className="px-4 py-3 flex items-center justify-between">
                <div className="text-neutral-500">모니터 수량</div>
                <div className="font-semibold">{fmtNum(selected.monitors, "대")}</div>
              </div>

              {/* N7 월 송출횟수 */}
              <div className="px-4 py-3 flex items-center justify-between">
                <div className="text-neutral-500">월 송출횟수</div>
                <div className="font-semibold">{fmtNum(selected.monthlyImpressions, "회")}</div>
              </div>

              {/* N8 월 광고료 */}
              <div className="px-4 py-3 flex items-center justify-between">
                <div className="text-neutral-500">월 광고료</div>
                <div className="font-semibold">{fmtWon(selected.monthlyFee)}</div>
              </div>

              {/* N9 1회 당 송출비용 */}
              <div className="px-4 py-3 flex items-center justify-between">
                <div className="text-neutral-500">1회 당 송출비용</div>
                <div className="font-semibold">{fmtWon(selected.perPlayCost)}</div>
              </div>

              {/* N10 운영 시간 */}
              <div className="px-4 py-3 flex items-center justify-between">
                <div className="text-neutral-500">운영 시간</div>
                <div className="font-semibold">{selected.hours ?? "—"}</div>
              </div>

              {/* N11 주소 */}
              <div className="px-4 py-3 flex items-center justify-between">
                <div className="text-neutral-500">주소</div>
                <div className="font-semibold max-w-[420px] truncate">{selected.address ?? "—"}</div>
              </div>
            </div>
          </section>
        </div>
      ) : (
        // 선택 없을 때 간단 가이드
        <div className="p-6 text-sm text-neutral-500">지도의 마커를 클릭하면 상세 정보가 여기에 나타납니다.</div>
      )}
    </aside>
  );
}

