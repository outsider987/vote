import React from "react";
import SvgLoader from "@/app/components/SvgLoader";

interface ProgressBarProps {
  value: number;
  icon?: string;
  dangerThreshold?: number;
  className?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  icon,
  dangerThreshold = 20,
  className = "",
}) => {
  return (
    <div className={`flex flex-col w-full ${className}`}>
      <div
        className="w-full min-h-[30px] bg-white bg-opacity-50 rounded-full h-2.5 mb-4 relative"
        style={{
          clipPath: "inset(0 round 15px)",
        }}
      >
        <div
          className={`relative min-h-[30px] rounded-full ${
            value > dangerThreshold ? "bg-[#3E90F1]" : "bg-[#CE464E]"
          }`}
          style={{
            width: `${value}%`,
          }}
        >
          <div className="flex items-center min-h-[30px] pl-2 tracking-wider gap-2">
            {icon && <SvgLoader className="" name={icon} />}
            {value.toFixed(0)}%
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProgressBar;
