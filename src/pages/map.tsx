function loadKakao(appkey: string) {
  return new Promise<void>((resolve, reject) => {
    const w: any = window;
    if (w.kakao?.maps) return resolve();
    const s = document.createElement("script");
    s.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${appkey}&autoload=false`;
    s.async = true;
    s.onerror = () => reject(new Error("Kakao SDK load failed"));
    s.onload = () => {
      w.kakao.maps.load(() => resolve());
    };
    document.head.appendChild(s);
  });
}

function loadNaver(clientId: string) {
  return new Promise<void>((resolve, reject) => {
    const w: any = window;
    if (w.naver?.maps) return resolve();
    const s = document.createElement("script");
    s.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${clientId}`;
    s.async = true;
    s.defer = true;
    s.onerror = () => reject(new Error("Naver SDK load failed"));
    s.onload = () => resolve();
    document.head.appendChild(s);
  });
}

function MapCanvas() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    (async () => {
      try {
        const kakaoKey = import.meta.env.VITE_KAKAO_JS_KEY as string | undefined;
        const naverId = import.meta.env.VITE_NAVER_CLIENT_ID as string | undefined;

        if (kakaoKey) {
          await loadKakao(kakaoKey);
          const w: any = window;
          const center = new w.kakao.maps.LatLng(37.5665, 126.9780);
          const map = new w.kakao.maps.Map(el, { center, level: 6 });
          void map;
          return;
        }

        if (naverId) {
          await loadNaver(naverId);
          const w: any = window;
          const map = new w.naver.maps.Map(el, {
            center: new w.naver.maps.LatLng(37.5665, 126.9780),
            zoom: 12,
          });
          void map;
          return;
        }

        console.warn("No map keys set: add VITE_KAKAO_JS_KEY or VITE_NAVER_CLIENT_ID in .env");
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  return <div ref={ref} className="w-full h-full" />;
}

