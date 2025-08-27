import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { UploadLocations } from "@/components/UploadLocations";
import { ColumnMappingModal } from "@/components/ColumnMappingModal";
import { ImportSummary } from "@/components/ImportSummary";
import { geocodeAddress } from "@/utils/geocode";
import { ParsedRow, ColumnMapping, Place, ImportResult } from "@/types/Place";

declare global { interface Window { kakao: any } }

export default function MapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObj = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const clustererRef = useRef<any>(null);
  
  // Search state
  const [kw, setKw] = useState("");
  
  // Upload state
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showColumnMapping, setShowColumnMapping] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  
  const { toast } = useToast();

  useEffect(() => {
    // URL ?q=... 읽기
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q") || "";
    setKw(q);

    // Kakao SDK 로드 (services, clusterer 포함)
    const JS_KEY = "a53075efe7a2256480b8650cec67ebae"; // ← JS 키(REST 아님)
    const SDK = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${JS_KEY}&libraries=services,clusterer&autoload=false`;

    const onload = () => window.kakao.maps.load(init);
    const exist = document.querySelector(`script[src^="${SDK}"]`) as HTMLScriptElement | null;
    if (exist) exist.addEventListener("load", onload);
    else {
      const s = document.createElement("script");
      s.src = SDK; s.async = true; s.onload = onload;
      document.head.appendChild(s);
    }

    function init() {
      if (!mapRef.current) return;
      const { kakao } = window;

      // 초기 맵(임시로 서울시청 중심, 마커는 만들지 않음)
      const map = new kakao.maps.Map(mapRef.current, {
        center: new kakao.maps.LatLng(37.5665, 126.9780),
        level: 5,
      });
      mapObj.current = map;
      
      // Initialize clusterer for handling many markers
      if (kakao.maps.MarkerClusterer) {
        clustererRef.current = new kakao.maps.MarkerClusterer({
          map: map,
          averageCenter: true,
          minLevel: 10,
        });
      }

      // 최초 진입 시 q가 있으면 바로 검색 실행
      if (q) runSearch(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 검색 실행: 장소검색 → 실패 시 주소 지오코딩
  function runSearch(query: string) {
    const { kakao } = window;
    const map = mapObj.current;
    if (!map) return;

    const places = new kakao.maps.services.Places();
    places.keywordSearch(query, (data: any[], status: string) => {
      if (status === kakao.maps.services.Status.OK && data.length) {
        // 결과 마커(첫 결과 기준으로 이동)
        const d = data[0];
        const pos = new kakao.maps.LatLng(d.y, d.x);
        new kakao.maps.Marker({ position: pos }).setMap(map);
        map.setLevel(4);
        map.setCenter(pos);

        // 여러 결과를 모두 보여주고 싶으면 아래 주석 해제
        // const bounds = new kakao.maps.LatLngBounds();
        // data.forEach(it => bounds.extend(new kakao.maps.LatLng(it.y, it.x)));
        // map.setBounds(bounds);
      } else {
        // 장소검색 결과 없으면 주소 지오코딩
        const geocoder = new kakao.maps.services.Geocoder();
        geocoder.addressSearch(query, (res: any[], stat: string) => {
          if (stat === kakao.maps.services.Status.OK && res[0]) {
            const { y, x } = res[0];
            const pos = new kakao.maps.LatLng(y, x);
            new kakao.maps.Marker({ position: pos }).setMap(map);
            map.setLevel(4);
            map.setCenter(pos);
          } else {
            alert("검색 결과가 없습니다.");
          }
        });
      }
    }, { size: 15 });
  }

  // Handle file upload and parsing
  function handleFilesParsed(rows: ParsedRow[]) {
    setParsedRows(rows);
    setShowUploadModal(false);
    setShowColumnMapping(true);
  }

  // Handle column mapping confirmation
  async function handleColumnMapping(mapping: ColumnMapping) {
    if (!parsedRows.length) return;

    setIsProcessing(true);
    setProgress(0);
    
    const result: ImportResult = {
      totalRows: parsedRows.length,
      geocoded: 0,
      failed: 0,
      plotted: 0,
      failedAddresses: []
    };

    const newPlaces: Place[] = [];
    
    try {
      for (let i = 0; i < parsedRows.length; i++) {
        const row = parsedRows[i];
        const place: Place = {
          id: `place-${i}`,
          name: mapping.name ? String(row[mapping.name] || '') : '',
          category: mapping.category ? String(row[mapping.category] || '') : '',
          notes: mapping.notes ? String(row[mapping.notes] || '') : '',
        };

        // Get coordinates
        if (mapping.latitude && mapping.longitude) {
          const lat = parseFloat(String(row[mapping.latitude] || '0'));
          const lng = parseFloat(String(row[mapping.longitude] || '0'));
          
          if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
            place.lat = lat;
            place.lng = lng;
            newPlaces.push(place);
            result.plotted++;
          }
        } else if (mapping.address) {
          const address = String(row[mapping.address] || '').trim();
          place.address = address;
          
          if (address) {
            try {
              const coords = await geocodeAddress(address);
              if (coords) {
                place.lat = coords.lat;
                place.lng = coords.lng;
                newPlaces.push(place);
                result.geocoded++;
                result.plotted++;
              } else {
                result.failed++;
                result.failedAddresses.push(address);
              }
            } catch (error) {
              result.failed++;
              result.failedAddresses.push(address);
            }
          }
        }

        setProgress(Math.round(((i + 1) / parsedRows.length) * 100));
        
        // Small delay to prevent overwhelming the API
        if (mapping.address && !mapping.latitude) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      setPlaces(prev => [...prev, ...newPlaces]);
      setImportResult(result);
      
      // Plot markers on map
      if (newPlaces.length > 0) {
        plotMarkersOnMap(newPlaces);
      }

      toast({
        title: "가져오기 완료",
        description: `${result.plotted}개의 위치가 지도에 표시되었습니다.`
      });

    } catch (error) {
      toast({
        title: "가져오기 실패",
        description: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  }

  // Plot markers on the map
  function plotMarkersOnMap(places: Place[]) {
    const { kakao } = window;
    const map = mapObj.current;
    if (!map || !places.length) return;

    // Clear existing markers
    if (clustererRef.current) {
      clustererRef.current.clear();
    }
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    const markers: any[] = [];
    const bounds = new kakao.maps.LatLngBounds();

    places.forEach(place => {
      if (place.lat && place.lng) {
        const position = new kakao.maps.LatLng(place.lat, place.lng);
        const marker = new kakao.maps.Marker({
          position: position,
          title: place.name || place.address || ''
        });

        // Create info window content
        const infoContent = `
          <div style="padding:8px; min-width:200px;">
            ${place.name ? `<div style="font-weight:bold; margin-bottom:4px;">${place.name}</div>` : ''}
            ${place.address ? `<div style="color:#666; font-size:12px; margin-bottom:4px;">${place.address}</div>` : ''}
            ${place.category ? `<div style="background:#e3f2fd; color:#1976d2; padding:2px 6px; border-radius:12px; font-size:10px; display:inline-block; margin-bottom:4px;">${place.category}</div>` : ''}
            ${place.notes ? `<div style="color:#888; font-size:11px;">${place.notes}</div>` : ''}
          </div>
        `;

        const infoWindow = new kakao.maps.InfoWindow({
          content: infoContent
        });

        // Add click event to show info window
        kakao.maps.event.addListener(marker, 'click', () => {
          infoWindow.open(map, marker);
        });

        markers.push(marker);
        bounds.extend(position);
      }
    });

    markersRef.current = markers;

    // Use clusterer for many markers, otherwise add directly
    if (markers.length > 100 && clustererRef.current) {
      clustererRef.current.addMarkers(markers);
    } else {
      markers.forEach(marker => marker.setMap(map));
    }

    // Fit map to show all markers
    if (markers.length > 0) {
      map.setBounds(bounds);
    }
  }

  // 맵 상단에서 재검색 가능(선택사항)
  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = kw.trim();
    if (!q) return;
    runSearch(q);
    const u = new URL(window.location.href);
    u.searchParams.set("q", q);
    window.history.replaceState({}, "", u.toString());
  }

  const columns = parsedRows.length > 0 ? Object.keys(parsedRows[0]) : [];

  return (
    <div style={{ width: "100%", minHeight: "100vh", position: "relative" }}>
      {/* 재검색 바 (원하면 숨겨도 됨) */}
      <form onSubmit={onSubmit}
        style={{position:"absolute",zIndex:10,top:12,left:"50%",transform:"translateX(-50%)",
                background:"#fff",borderRadius:12,padding:8,boxShadow:"0 4px 16px rgba(0,0,0,.12)",
                display:"flex",gap:8,alignItems:"center"}}>
        <input
          value={kw}
          onChange={e=>setKw(e.target.value)}
          placeholder="지역/아파트/단지명 검색"
          style={{width:300,padding:"8px 10px",border:"1px solid #e5e7eb",borderRadius:8}}
          disabled={isProcessing}
        />
        <button type="submit" 
          disabled={isProcessing}
          style={{padding:"8px 12px",border:0,borderRadius:8,background:"#5b21b6",color:"#fff",cursor:"pointer",opacity:isProcessing?0.5:1}}>
          검색
        </button>
      </form>

      {/* Upload Locations Button - Top Left */}
      <div style={{
        position: "absolute", 
        zIndex: 10, 
        top: 12, 
        left: 12,
        background: "#fff",
        borderRadius: 12,
        padding: 8,
        boxShadow: "0 4px 16px rgba(0,0,0,.12)"
      }}>
        <Button 
          onClick={() => setShowUploadModal(true)}
          disabled={isProcessing}
          variant="outline"
          size="sm"
        >
          위치 업로드
        </Button>
      </div>

      {/* Progress Bar - Top */}
      {isProcessing && (
        <div style={{
          position: "absolute",
          zIndex: 10,
          top: 70,
          left: "50%",
          transform: "translateX(-50%)",
          background: "#fff",
          borderRadius: 12,
          padding: 12,
          boxShadow: "0 4px 16px rgba(0,0,0,.12)",
          minWidth: 300
        }}>
          <div className="text-sm text-center mb-2">위치 처리 중... {progress}%</div>
          <Progress value={progress} className="w-full" />
        </div>
      )}

      {/* Import Summary - Top Right */}
      {importResult && (
        <div style={{
          position: "absolute",
          zIndex: 10,
          top: 12,
          right: 12,
          minWidth: 200
        }}>
          <ImportSummary result={importResult} />
        </div>
      )}

      <div ref={mapRef} style={{ width: "100%", height: "100vh" }} />

      {/* Upload Modal */}
      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>위치 파일 업로드</DialogTitle>
          </DialogHeader>
          <UploadLocations 
            onFilesParsed={handleFilesParsed}
            isProcessing={isProcessing}
          />
        </DialogContent>
      </Dialog>

      {/* Column Mapping Modal */}
      {parsedRows.length > 0 && (
        <ColumnMappingModal
          open={showColumnMapping && parsedRows.length > 0}
          onOpenChange={(open) => {
            if (!open) {
              setShowColumnMapping(false);
              setParsedRows([]);
            }
          }}
          columns={columns}
          sampleData={parsedRows.slice(0, 3)}
          onConfirm={handleColumnMapping}
        />
      )}
    </div>
  );
}