import React, { useState } from "react";
import InquiryModal from "./InquiryModal";

type InquiryKind = "SEAT" | "PACKAGE";

type Prefill = {
  apt_id?: string | null;
  apt_name?: string | null;
  product_code?: string | null;
  product_name?: string | null;
  cart_snapshot?: any | null;
};

interface OpenInquiryModalProps {
  trigger: React.ReactElement;
  mode: InquiryKind;
  prefill?: Prefill;
  sourcePage?: string;
  onSubmitted?: (rowId: string) => void;
}

export default function OpenInquiryModal({
  trigger,
  mode,
  prefill,
  sourcePage,
  onSubmitted,
}: OpenInquiryModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleOpen = () => setIsOpen(true);
  const handleClose = () => setIsOpen(false);

  const handleSubmitted = (rowId: string) => {
    onSubmitted?.(rowId);
    handleClose();
  };

  return (
    <>
      {React.cloneElement(trigger, { onClick: handleOpen })}
      <InquiryModal
        open={isOpen}
        mode={mode}
        prefill={prefill}
        sourcePage={sourcePage}
        onClose={handleClose}
        onSubmitted={handleSubmitted}
      />
    </>
  );
}