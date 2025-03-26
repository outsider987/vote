import CopySvg from "@/public/svgs/copy.svg";
import clsx from "clsx";
import Image from "next/image";

const CopyButton = ({
  text,
  className,
}: {
  text: string;
  className?: string;
}) => {
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
  };
  return (
    <button
      className={clsx("flex items-center gap-2", className)}
      onClick={handleCopy}
    >
      {text}
      <CopySvg className="w-6 h-6" />
    </button>
  );
};

export default CopyButton;
