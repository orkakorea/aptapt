import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import InquiryModal from "./InquiryModal";

type InquiryKind = "SEAT" | "PACKAGE";

type Prefill = {
  apt_id?: string | null;
  apt_name?: string | null;
  product_code?: string | null;
  product_name?: string | null;
  cart_snapshot?: any | null;
};

type OpenOptions = {
  mode?: InquiryKind;                 // 기본 "SEAT"
  prefill?: Prefill;
  sourcePage?: string;
  onSubmitted?: (rowId: string) => void;

  /** 기본값: true — 배경 클릭 시 닫기 */
  dismissOnBackdrop?: boolean;
  /** 기본값: true — ESC 누르면 닫기 */
  dismissOnEsc?: boolean;
};

const CONTAINER_ID = "__inquiry_modal_portal__";

/**
 * 어디서든 호출해서 InquiryModal을 단독으로 띄운다.
 * - 자동으로 사라지지 않음(사용자 동작으로만 닫힘)
 * - 여러 번 호출 시 기존 컨테이너를 먼저 정리 후 새로 연다(중복 방지)
 */
export default function openInquiryModal(opts: OpenOptions) {
  const dismissOnBackdrop = opts.dismissOnBackdrop ?? true;
  const dismissOnEsc = opts.dismissOnEsc ?? true;

  // 기존 컨테이너가 남아있다면 먼저 제거(중복 방지)
  const prev = document.getElementById(CONTAINER_ID);
  if (prev && prev.parentElement) {
    prev.parentElement.removeChild(prev);
  }

  const container = Object.assign(document.createElement("div"), { id: CONTAINER_ID });
  document.body.appendChild(container);

  const root = createRoot(container);

  function unmount() {
    try {
      root.unmount();
    } finally {
      if (container.parentElement) container.parentElement.removeChild(container);
    }
  }

  function ModalHost() {
    const [open, setOpen] = useState(true);

    // ESC 닫기
    useEffect(() => {
      if (!dismissOnEsc) return;
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") setOpen(false);
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [dismissOnEsc]);

    // sourcePage 기본값: 현재 경로
    const sourcePage = useMemo(() => {
      if (opts?.sourcePage) return opts.sourcePage;
      if (typeof window !== "undefined") return window.location.pathname;
      return "/quote";
    }, [opts?.sourcePage]);

    // InquiryModal은 자체 백드롭을 가지고 있고, 백드롭 클릭 시 onClose가 호출됨.
    // dismissOnBackdrop=false 인 경우, onClose에서 open=false를 막기 위해 no-op 처리.
    const handleClose = () => {
      if (dismissOnBackdrop) setOpen(false);
      // dismissOnBackdrop=false면 아무 일도 하지 않음(사용자 의도)
    };

    useEffect(() => {
      if (!open) {
        // 닫히면 즉시 정리
        unmount();
      }
    }, [open]);

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
        onClose={handleClose}
      />
    );
  }

  root.render(<ModalHost />);

  // 호출자가 수동으로 닫고 싶을 때 사용
  return { close: unmount };
}
