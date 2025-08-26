<!-- 지도 영역 -->
<div id="map" style="width:100%;height:100vh;"></div>

<!-- Kakao Map SDK -->
<script src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=a53075efe7a2256480b8650cec67ebae&libraries=services,clusterer&autoload=false"></script>
<script>
  kakao.maps.load(function () {
    // 지도 컨테이너와 옵션
    const container = document.getElementById('map');
    const options = {
      center: new kakao.maps.LatLng(37.5665, 126.9780), // 서울시청 좌표
      level: 5
    };

    // 지도 생성
    const map = new kakao.maps.Map(container, options);

    // 마커 생성
    const marker = new kakao.maps.Marker({
      position: new kakao.maps.LatLng(37.5665, 126.9780)
    });
    marker.setMap(map);
  });
</script>
