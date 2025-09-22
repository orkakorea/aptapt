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
 * - 관리자 대시보드(KPI + 차트 4종)
 * - 현재 프로젝트의 Supabase 타입에 'inquiries'가 없으므로 any 캐스팅으로 최소 동작 보장
 * - 집계 쿼리는 count 전용 호출(HEAD) 위주, 차트는 최근 6개월/7일만 로드
 * - 이후 supabase 타입 재생성 시 any 제거 가능
 */

type InquiryStatus = "new" | "pending" | "in_progress" | "done" | "canceled";

type Kpis = {
  todayNew: number;
  unread: number; // 미확인(new)
  total: number;
  valid: number;
  invalid: number;
  inProgress: number;
  done: number;
};

type ChartMonthPoint = { month: string; count: number };
type ChartDonutPoint = { name: string; value: number };
type ChartDayPoint = { day: string; count: number };

const MONTHS = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];
const WEEKDAYS = ["월","화","수","목","금","토","일"];

const DashboardPage: React.FC = () => {
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [monthly, setMonthly] = useState<ChartMonthPoint[]>([]);
  const [validDonut, setValidDonut] = useState<ChartDonutPoint[]>([]);
  const [statusDonut, setStatusDonut] = useState<ChartDonutPoint[]>([]);
  const [last7, setLast7] = useState<ChartDayPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // 기간 기준 계산
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

        // === KPI: count 전용 호출들 ===
        const [
          totalRes,
          validRes,
          invalidRes,
          unreadRes,
          inprogRes,
          doneRes,
          todayNewRes,
        ] = await Promise.all([
          sb.from("inquiries").select("id", { count: "exact", head: true }),
          sb.from("inquiries").select("id", { count: "exact", head: true }).eq("valid", true),
          sb.from("inquiries").select("id", { count: "exact", head: true }).eq("valid", false),
          sb.from("inquiries").select("id", { count: "exact", head: true }).eq("status", "new"),
          sb.from("inquiries").select("id", { count: "exact", head: true }).eq("status", "in_progress"),
          sb.from("inquiries").select("id", { count: "exact", head: true }).eq("status", "done"),
          sb
            .from("inquiries")
            .select("id", { count: "exact", head: true })
            .gte("created_at", toIso(todayStart))
            .lt("created_at", toIso(todayEnd)),
        ]);

        if (anyError([totalRes, validRes, invalidRes, unreadRes, inprogRes, doneRes, todayNewRes])) {
          throw new Error("KPI 집계 중 오류가 발생했습니다.");
        }

        const k: Kpis = {
          todayNew: todayNewRes.count ?? 0,
          unread: unreadRes.count ?? 0,
          total: totalRes.count ?? 0,
          valid: validRes.count ?? 0,
          invalid: invalidRes.count ?? 0,
          inProgress: inprogRes.count ?? 0,
          done: doneRes.count ?? 0,
        };

        // === 차트용 원본 데이터 (최근 6개월 / 최근 7일) ===
        // created_at, valid, status 만 조회
        const [{ data: sixM }, { data: sevenD }] = await Promise.all([
          sb
            .from("inquiries")
            .select("id, created_at, valid, status")
            .gte("created_at", toIso(sixMonthsAgo))
            .order("created_at", { ascending: true }),
          sb
            .from("inquiries")
            .select("id, created_at, valid, status")
            .gte("created_at", toIso(sevenDaysAgo))
            .order("created_at", { ascending: true }),
        ]);

        // 월별 추이
        const monthMap = new Map<string, number>();
        // 6개월 라벨 먼저 채우기(데이터 없어도 0 표시)
        const labels6 = listLastSixMonthLabels(now);
        labels6.forEach((m) => monthMap.set(m, 0));
        (sixM || []).forEach((r: any) => {
          const d = new Date(r.created_at);
          const key = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}`;
          const label = `${d.getFullYear()}.${MONTHS[d.getMonth()]}`;
          // label 표준화: labels6에 맞춰 매핑
          const match = labels6.find((l) => l.startsWith(`${d.getFullYear()}.`) && l.endsWith(MONTHS[d.getMonth()]));
          const use = match ?? label;
          monthMap.set(use, (monthMap.get(use) || 0) + 1);
        });
        const monthSeries: ChartMonthPoint[] = Array.from(monthMap.entries()).map(([month, count]) => ({ month, count }));

        // 유효/무효 도넛
        const validCount = (sixM || []).filter((r: any) => !!r.valid).length;
        const invalidCount = (sixM || []).filter((r: any) => r.valid === false).length;
        const validSeries: ChartDonutPoint[] = [
          { name: "유효", value: validCount },
          { name: "무효", value: invalidCount },
        ];

        // 처리 상태 도넛
        const statusBuckets: Record<string, number> = {};
        (sixM || []).forEach((r: any) => {
          const s: InquiryStatus = r.status || "pending";
          statusBuckets[s] = (statusBuckets[s] || 0) + 1;
        });
        const statusSeries: ChartDonutPoint[] = Object.entries(statusBuckets).map(([name, value]) => ({
          name: toStatusLabel(name as InquiryStatus),
          value,
        }));

        // 최근 7일 추이
        const dayMap = new Map<string, number>();
        const days = listLast7Days(now);
        days.forEach((d) => dayMap.set(d, 0));
        (sevenD || []).forEach((r: any) => {
          const d = new Date(r.created_at);
          const label = WEEKDAYS[(d.getDay() + 6) % 7]; // 월=0 … 일=6
          dayMap.set(label, (dayMap.get(label) || 0) + 1);
        });
        const daySeries: ChartDayPoint[] = days.map((d) => ({ day: d, count: dayMap.get(d) || 0 }));

        if (ignore) return;
        setKpis(k);
        setMonthly(monthSeries);
        setValidDonut(validSeries);
        setStatusDonut(statusSeries);
        setLast7(daySeries);
      } catch (e: any) {
        if (!ignore) setErr(e?.message ?? "대시보드 로딩 오류");
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    run();
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl font-semibold">대시보드 개요</h2>
        <p className="text-sm text-gray-500">광고 문의 현황 및 통계 정보</p>
      </header>

      {/* KPI 카드 */}
      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
        <StatCard title="신규 광고문의" value={kpis?.todayNew} hint="오늘 접수" />
        <StatCard title="미확인" value={kpis?.unread} hint="status=new" />
        <StatCard title="누적 문의 수" value={kpis?.total} emphasize />
        <StatCard title="누적 유효 문의" value={kpis?.valid} />
        <StatCard title="누적 무효 문의" value={kpis?.invalid} />
        <StatCard title="진행중" value={kpis?.inProgress} />
        <StatCard title="완료건" value={kpis?.done} emphasize />
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
              <Bar dataKey="count" radius={[8, 8, 0, 0]} />
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
                  <Cell key={i} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </ChartPanel>
      </section>

      {/* 차트 2행 */}
      <section className="grid gap-4 md:grid-cols-2">
        <ChartPanel title="처리 상태 현황">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Tooltip />
              <Pie
                data={statusDonut}
                dataKey="value"
                nameKey="name"
                innerRadius={70}
                outerRadius={100}
                paddingAngle={2}
              >
                {statusDonut.map((_, i) => (
                  <Cell key={i} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="최근 7일 문의의 추이">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={last7}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" dot />
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
 *  작은 프레젠테이션 컴포넌트
 * ========================= */

const StatCard: React.FC<{
  title: string;
  value?: number | null;
  hint?: string;
  emphasize?: boolean;
}> = ({ title, value, hint, emphasize }) => {
  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
      <div className="text-sm text-gray-500">{title}</div>
      <div className={"mt-2 font-bold " + (emphasize ? "text-2xl" : "text-xl")}>
        {value ?? 0}
        <span className="sr-only">건</span>
      </div>
      {hint && <div className="mt-1 text-xs text-gray-400">{hint}</div>}
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
  // YYYY-MM-DDTHH:mm:ss.sssZ 형태
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();
}

function anyError(resArr: any[]) {
  return resArr.some((r) => r?.error);
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

function toStatusLabel(s: InquiryStatus) {
  switch (s) {
    case "new":
      return "신규";
    case "pending":
      return "대기";
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
