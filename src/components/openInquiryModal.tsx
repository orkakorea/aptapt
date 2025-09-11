import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import InquiryModal from "./InquiryModal";

type InquiryKind = "SEAT" | "PACKAGE";

// InquiryModal 내부에서 사용하는 prefill 구조의 최소 타입
type Prefill = {
  apt_id?: string | null;
  apt_name?: string | null;
  product_code?: string | null;
  product_name?: string | null;
  cart_snapshot?: any | null;
};

type OpenOptions = {
  mode?: InquiryKind;            // 기본 SEAT
  prefill?: Prefill;
  sourcePage?: string;
  onSubmitted?: (rowId: string) => void;
};

const CONTAINER_ID = "__inquiry_modal_portal__";

// 외부 어디서든 호출해서 InquiryModal을 단독으로 띄우는 함수
export function openInquiryModal(opts: OpenOptions) {
  const container =
    document.getElementById(CONTAINER_ID) ||
    Object.assign(document.createElement("div"), { id: CONTAINER_ID });

  if (!container.parentElement) {
    document.body.appendChild(container);
  }

  const root = createRoot(container);

  function unmount() {
    // 약간의 페이드아웃 여유가 필요하면 setTimeout으로 조절 가능
    root.unmount();
    if (container.parentElement) container.parentElement.removeChild(container);
  }

  function ModalHost() {
    const [open, setOpen] = useState(true);

    // ESC로 닫기 등 전역 핸들링(선택)
    useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") setOpen(false);
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, []);

    // sourcePage 기본값: 현재 경로
    const sourcePage = useMemo(() => {
      if (opts?.sourcePage) return opts.sourcePage;
      if (typeof window !== "undefined") return window.location.pathname;
      return "/quote";
    }, [opts?.sourcePage]);

    return (
      <InquiryModal
        open={open}
        mode={opts?.mode ?? "SEAT"}
        prefill={opts?.prefill}
        sourcePage={sourcePage}
        onSubmitted={(id) => {
          opts?.onSubmitted?.(id);
          setOpen(false);
        }}
        onClose={() => setOpen(false)}
      />
    );
  }

  root.render(<ModalHost />);

  // 언마운트 정리: InquiryModal 내부에서 open=false가 되면 unmount
  // 간단히 MutationObserver로 open 상태 감지 대신, 200ms 폴링으로 컨테이너 존재 체크
  // (InquiryModal이 사라지면 root.unmount 호출되도록 타임아웃으로 정리)
  // 여기선 InquiryModal 쪽에서 닫히면 컴포넌트가 언마운트되므로, 약간의 지연 후 컨테이너만 제거
  setTimeout(() => {
    // 안전장치: 10초 뒤에도 남아있으면 제거
    setTimeout(() => {
      if (document.getElementById(CONTAINER_ID)) {
        unmount();
      }
    }, 10000);
  }, 0);

  return { close: unmount };
}

export default openInquiryModal;
