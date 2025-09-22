import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, MapPin, MessageSquare, TrendingUp, Calendar, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface DashboardStats {
  totalUsers: number;
  totalPlaces: number;
  totalInquiries: number;
  todayVisits: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalPlaces: 0,
    totalInquiries: 0,
    todayVisits: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardStats();
  }, []);

  const loadDashboardStats = async () => {
    try {
      setLoading(true);
      
      // Get total places count
      const { count: placesCount } = await supabase
        .from('raw_places')
        .select('*', { count: 'exact', head: true });

      setStats({
        totalUsers: 150, // Mock data for now
        totalPlaces: placesCount || 0,
        totalInquiries: 24, // Mock data for now
        todayVisits: 89, // Mock data for now
      });
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: "총 사용자",
      value: stats.totalUsers,
      icon: Users,
      description: "등록된 전체 사용자 수",
      trend: "+12%",
      color: "text-primary",
    },
    {
      title: "등록된 장소",
      value: stats.totalPlaces,
      icon: MapPin,
      description: "데이터베이스 내 장소 수",
      trend: "+5%",
      color: "text-secondary",
    },
    {
      title: "문의 사항",
      value: stats.totalInquiries,
      icon: MessageSquare,
      description: "접수된 문의 건수",
      trend: "+8%",
      color: "text-accent",
    },
    {
      title: "오늘 방문자",
      value: stats.todayVisits,
      icon: Eye,
      description: "금일 사이트 방문자 수",
      trend: "+15%",
      color: "text-primary",
    },
  ];

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">관리자 대시보드</h1>
          <p className="text-muted-foreground mt-2">시스템 현황과 주요 지표를 확인하세요</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Calendar className="h-4 w-4 mr-2" />
            오늘
          </Button>
          <Button size="sm" onClick={loadDashboardStats}>
            새로고침
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => (
          <Card key={index} className="relative overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                {stat.title}
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-3xl font-bold text-foreground">
                  {loading ? "..." : stat.value.toLocaleString()}
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{stat.description}</p>
                  <Badge variant="secondary" className="text-xs">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    {stat.trend}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              최근 문의
            </CardTitle>
            <CardDescription>
              최근 접수된 문의 사항들입니다
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {loading ? (
                <p className="text-muted-foreground">로딩 중...</p>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm">새로운 문의가 접수되었습니다</span>
                    <Badge variant="outline">신규</Badge>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm">장소 정보 수정 요청</span>
                    <Badge variant="secondary">진행중</Badge>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm">지도 오류 신고</span>
                    <Badge variant="destructive">긴급</Badge>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              시스템 상태
            </CardTitle>
            <CardDescription>
              현재 시스템 운영 상태입니다
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm">서버 상태</span>
                <Badge className="bg-green-500 text-white">정상</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">데이터베이스</span>
                <Badge className="bg-green-500 text-white">정상</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">지오코딩 서비스</span>
                <Badge className="bg-yellow-500 text-white">점검중</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">맵 서비스</span>
                <Badge className="bg-green-500 text-white">정상</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}