import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";

/**
 * DashboardPage
 * - KPI 카드
 *   · 신규 광고문의 = 오늘 문의건
 *   · 미확인 = status='new'
 *   · 누적문의 = 전체 count
 *   · 누적 유효 문의 = valid=true
 *   · 누적 무효 문의 = valid=false
 *   · 진행중 = status='in_progress'
 *   · 완료건 = status='done'
 * - 월별 문의 추이: 최근 6개월 막대 그래프
 * - 유효/무효 문의 비율: 도넛 그래프
 * - 처리 상태 현황: 최근 항목 리스트(브랜드명 + 진행상황 + 담당자)
 * - 최근 7일 문의 추이: 라인 그래프
 *
 * Supabase 타입 정의가 없을 수 있어 any 캐스팅 사용
 */

type InquiryStatus = "new" | "in_progress" | "done" | "canceled";

type Kpis = {
  todayNew: number;
  unread: number; // status=new
  total: number;
  valid: number; // valid=true
  invalid: number; // valid=false
  inProgress: number; // status=in_progress
  done: number; // status=done
};

type ChartMonthPoint = { month: string; count: number };
type ChartDonutPoint = { name: string; value: number };
type ChartDayPoint = { day: string; count: number };

type StatusRow = {
  id: string;
  company: string | null;
  status: InquiryStatus | null;
  assignee: string | null;
  created_at: string;
};

const MONTHS = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];
const WEEKDAYS = ["월","화","수","목","금","토","일"];
const DONUT_COLORS = ["#10B981", "#F43F5E"]; // 유효, 무효
const BAR_COLOR = "#7C3AED";
const LINE_COLOR = "#2563EB";

const DashboardPage: React.FC = () => {
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [monthly, setMonthly] = useState<ChartMonthPoint[]>([]);
  const [validDonut, setValidDonut] = useState<ChartDonutPoint[]>([]);
  const [last7, setLast7] = useState<ChartDayPoint[]>([]);
  const [statusList, setStatusList] = useState<StatusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // 기간 기준
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1); // 이번 달 포함 6개월
  const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);

  useEffect(() => {
    let ignore = false;
    const run = async () => {
      setLoading(true);
      setErr(null);
      try {
        const sb: any = supabase;

        // ===== KPI 집계 (count 전용 HEAD 호출) =====
        const [
          totalRes,
          todayNewRes,
          unreadRes,
          validRes,
          invalidRes,
          inProgressRes,
          doneRes,
        ] = await Promise.all([
          sb.from("inquiries").select("id", { count: "exact", head: true }),
          sb.from("inquiries").select("id", { count: "exact", head: true })
            .gte("created_at", toIso(todayStart)).lt("created_at", toIso(todayEnd)),
          sb.from("inquiries").select("id", { count: "exact", head: true }).eq("status", "new"),
          sb.from("inquiries").select("id", { count: "exact", head: true }).eq("valid", true),
          sb.from("inquiries").select("id", { count: "exact", head: true }).eq("valid", false),
          sb.from("inquiries").select("id", { count: "exact", head: true }).eq("status", "in_progress"),
          sb.from("inquiries").select("id", { count: "exact", head: true }).eq("status", "done"),
        ]);

        const k: Kpis = {
          todayNew: todayNewRes.count ?? 0,
          unread: unreadRes.count ?? 0,
          total: totalRes.count ?? 0,
          valid: validRes.count ?? 0,
          invalid: invalidRes.count ?? 0,
          inProgress: inProgressRes.count ?? 0,
          done: doneRes.count ?? 0,
        };

        // ===== 월별(최근 6개월) / 최근 7일 차트 원본 =====
        const [{ data: sixM, error: e1 }, { data: sevenD, error: e2 }] = await Promise.all([
          sb.from("inquiries")
            .select("id, created_at")
            .gte("created_at", toIso(sixMonthsAgo))
            .order("created_at", { ascending: true }),
          sb.from("inquiries")
            .select("id, created_at")
            .gte("created_at", toIso(sevenDaysAgo))
            .order("created_at", { ascending: true }),
        ]);
        if (e1 || e2) throw e1 || e2;

        // ===== 처리 상태 현황(최근 항목 12개) =====
        const { data: latest, error: e3 } = await sb
          .from("inquiries")
          .select("id, company, status, assignee, created_at")
          .order("created_at", { ascending: false })
          .limit(12);
        if (e3) throw e3;

        // 월별 집계
        const labels6 = listLastSixMonthLabels(now);
        const monthMap = new Map<string, number>();
        labels6.forEach((m) => monthMap.set(m, 0));
        (sixM || []).forEach((r: any) => {
          const d = new Date(r.created_at);
          const label = `${d.getFullYear()}.${MONTHS[d.getMonth()]}`;
          if (!monthMap.has(label)) monthMap.set(label, 0);
          monthMap.set(label, (monthMap.get(label) || 0) + 1);
        });
        const monthSeries: ChartMonthPoint[] = labels6.map((m) => ({
          month: m,
          count: monthMap.get(m) || 0,
        }));

        // 유효/무효 도넛
        const validSeries: ChartDonutPoint[] = [
          { name: "유효", value: k.valid },
          { name: "무효", value: k.invalid },
        ];

        // 최근 7일 라인
        const days = listLast7Days(now);
        const dayMap = new Map<string, number>();
        days.forEach((d) => dayMap.set(d, 0));
        (sevenD || []).forEach((r: any) => {
          const d = new Date(r.created_at);
          const label = WEEKDAYS[(d.getDay() + 6) % 7]; // 월=0 … 일=6
          dayMap.set(label, (dayMap.get(label) || 0) + 1);
        });
        const daySeries: ChartDayPoint[] = days.map((d) => ({
          day: d,
          count: dayMap.get(d) || 0,
        }));

        if (ignore) return;
        setKpis(k);
        setMonthly(monthSeries);
        setValidDonut(validSeries);
        setLast7(daySeries);
        setStatusList((latest as StatusRow[]) ?? []);
      } catch (e: any) {
        if (!ignore) setErr(e?.message ?? "대시보드 로딩 오류");
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    run();
    return () => { ignore = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">대시보드 개요</h2>
      <p className="text-sm text-gray-500">광고 문의 현황 및 통계 정보</p>

      {/* KPI 카드 (알록달록) */}
      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
        <ColoredStat title="신규 광고문의" value={kpis?.todayNew} hint="오늘 접수" color="violet" />
        <ColoredStat title="미확인" value={kpis?.unread} hint="status=new" color="blue" />
        <ColoredStat title="누적 문의 수" value={kpis?.total} emphasize color="slate" />
        <ColoredStat title="누적 유효 문의" value={kpis?.valid} color="emerald" />
        <ColoredStat title="누적 무효 문의" value={kpis?.invalid} color="rose" />
        <ColoredStat title="진행중" value={kpis?.inProgress} color="indigo" />
        <ColoredStat title="완료건" value={kpis?.done} emphasize color="amber" />
      </section>

      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </div>
      )}

      {/* 차트 1행 */}
      <section className="grid gap-4 md:grid-cols-2">
        <ChartPanel title="월별 문의의 추이">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthly}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" radius={[8, 8, 0, 0]} fill={BAR_COLOR} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="유효/무효 문의의 비율">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Tooltip />
              <Pie
                data={validDonut}
                dataKey="value"
                nameKey="name"
                innerRadius={70}
                outerRadius={100}
                paddingAngle={2}
              >
                {validDonut.map((_, i) => (
                  <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </ChartPanel>
      </section>

      {/* 차트 2행 */}
      <section className="grid gap-4 md:grid-cols-2">
        {/* 처리상태 현황: 목록 */}
        <ChartPanel title="처리 상태 현황">
          <div className="space-y-2 overflow-y-auto h-[280px] pr-1">
            {statusList.length === 0 ? (
              <div className="text-sm text-gray-500">데이터 없음</div>
            ) : (
              statusList.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-xl border border-gray-100 bg-white shadow-sm px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 truncate">
                      {r.company || "—"}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {formatDateTime(r.created_at)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={"px-2 py-0.5 text-xs rounded-full " + statusBadgeClass(r.status ?? "new")}>
                      {toStatusLabel(r.status ?? "new")}
                    </span>
                    <span className="text-sm text-gray-700">{r.assignee || "—"}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </ChartPanel>

        <ChartPanel title="최근 7일 문의의 추이">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={last7}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" dot stroke={LINE_COLOR} />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>
      </section>

      {loading && <SkeletonNote text="대시보드 데이터를 불러오는 중…" />}
    </div>
  );
};

export default DashboardPage;

/* =========================
 *  프레젠테이션 컴포넌트
 * ========================= */

const COLOR_MAP: Record<
  string,
  { bg: string; border: string; text: string; ring: string }
> = {
  violet:  { bg: "bg-violet-50",  border: "border-violet-100",  text: "text-violet-700",  ring: "ring-violet-200" },
  blue:    { bg: "bg-blue-50",    border: "border-blue-100",    text: "text-blue-700",    ring: "ring-blue-200" },
  slate:   { bg: "bg-slate-50",   border: "border-slate-100",   text: "text-slate-800",   ring: "ring-slate-200" },
  emerald: { bg: "bg-emerald-50", border: "border-emerald-100", text: "text-emerald-700", ring: "ring-emerald-200" },
  rose:    { bg: "bg-rose-50",    border: "border-rose-100",    text: "text-rose-700",    ring: "ring-rose-200" },
  indigo:  { bg: "bg-indigo-50",  border: "border-indigo-100",  text: "text-indigo-700",  ring: "ring-indigo-200" },
  amber:   { bg: "bg-amber-50",   border: "border-amber-100",   text: "text-amber-800",   ring: "ring-amber-200" },
};

const ColoredStat: React.FC<{
  title: string;
  value?: number | null;
  hint?: string;
  emphasize?: boolean;
  color: keyof typeof COLOR_MAP;
}> = ({ title, value, hint, emphasize, color }) => {
  const c = COLOR_MAP[color] ?? COLOR_MAP.slate;
  return (
    <div className={`rounded-2xl ${c.bg} ${c.border} border shadow-sm p-5`}>
      <div className={`text-sm ${c.text}`}>{title}</div>
      <div className={`mt-2 font-bold ${emphasize ? "text-2xl" : "text-xl"} ${c.text}`}>
        {value ?? 0}
        <span className="sr-only">건</span>
      </div>
      {hint && <div className={`mt-1 text-xs ${c.text}/80`}>{hint}</div>}
    </div>
  );
};

const ChartPanel: React.FC<React.PropsWithChildren<{ title: string }>> = ({
  title,
  children,
}) => (
  <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
    <div className="mb-3 font-semibold">{title}</div>
    <div className="h-[280px]">{children}</div>
  </div>
);

const SkeletonNote: React.FC<{ text: string }> = ({ text }) => (
  <div className="rounded-lg border border-gray-200 bg-white p-4">
    <div className="animate-pulse text-gray-500 text-sm">{text}</div>
  </div>
);

/* =========================
 *  유틸
 * ========================= */

function toIso(d: Date) {
  // YYYY-MM-DDTHH:mm:ss.sssZ 형태(로컬타임을 UTC로 보정)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();
}

function listLastSixMonthLabels(now: Date) {
  const out: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}.${MONTHS[d.getMonth()]}`);
  }
  return out;
}

function listLast7Days(now: Date) {
  // 월~일 순으로 정렬
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    days.push(WEEKDAYS[(d.getDay() + 6) % 7]);
  }
  return days;
}

function formatDateTime(iso: string) {
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, "0");
    const day = d.getDate().toString().padStart(2, "0");
    const hh = d.getHours().toString().padStart(2, "0");
    const mm = d.getMinutes().toString().padStart(2, "0");
    return `${y}-${m}-${day} ${hh}:${mm}`;
  } catch {
    return iso;
  }
}

function toStatusLabel(s: InquiryStatus) {
  switch (s) {
    case "new":
      return "신규";
    case "in_progress":
      return "진행중";
    case "done":
      return "완료";
    case "canceled":
      return "취소";
    default:
      return s;
  }
}

function statusBadgeClass(s: InquiryStatus): string {
  switch (s) {
    case "new":
      return "bg-violet-50 text-violet-700";
    case "in_progress":
      return "bg-blue-50 text-blue-700";
    case "done":
      return "bg-emerald-50 text-emerald-700";
    case "canceled":
      return "bg-gray-200 text-gray-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
}
