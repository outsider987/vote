import React from "react";
import Modal from ".";
import Button from "../Button";

interface ConfimModalProps {
  show: boolean;
  onClose: () => void;
  size?: "sm" | "md" | "lg" | "xl";
  buttonText?: string;

  title?: string;
  children?: React.ReactNode;
}

const ConfimModal = ({
  show,
  onClose,
  size,
  buttonText = "",
  title,
  children,
}: ConfimModalProps) => {
  return (
    <Modal
      title={title}
      show={show}
      onClose={onClose}
      size={size}
      footer={
        <Button
          rounded
          mode="secondaryContained"
          onClick={onClose}
          className="text-[18px] w-[180px] h-[54px]  sm:w-[120px] sm:h-[44px] md:w-[120px] md:h-[44px]"
        >
          {buttonText}
        </Button>
      }
    >
      <div className="flex flex-col items-center justify-center">
        {children}
      </div>
    </Modal>
  );
};

export default ConfimModal;
