import React, { useEffect, useState } from "react";

/**
 * 화면 폭에 맞춰 1920x1080 프레임을 균일 스케일로 "축소"만 함(업스케일 금지).
 * - 내부 children은 반드시 1920x1080 절대좌표 기준으로 작성되어야 함.
 * - transform-origin: top center 로 위에서 아래로 자연스럽게 스케일.
 */
export default function Fixed1920({ children }: { children: React.ReactNode }) {
  const BASE_W = 1920;
  const BASE_H = 1080;
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const update = () => {
      const vw = window.innerWidth;
      // 축소만 허용(화면이 더 넓으면 1배로 그대로 보여줌)
      const next = Math.min(vw / BASE_W, 1);
      setScale(next);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // 높이를 유지하려면, 바깥 컨테이너를 상대 위치로 두고
  // 안쪽 절대 박스를 scale 한 뒤, 바깥 높이를 BASE_H * scale 로 설정
  return (
    <div
      style={{
        position: "relative",
        height: BASE_H * scale,
        width: "100vw",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: "50%",
          width: BASE_W,
          height: BASE_H,
          transform: `translateX(-50%) scale(${scale})`,
          transformOrigin: "top center",
        }}
      >
        {children}
      </div>
    </div>
  );
}
