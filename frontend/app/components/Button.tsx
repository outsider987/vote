import { useMemo } from "react";
import clsx from "clsx";

type ButtonProps = {
  mode?:
    | "primary"
    | "primaryContained"
    | "primaryOutline"
    | "secondary"
    | "secondaryContained"
    | "secondaryOutline"
    | "secondaryBorder";

  rounded?: boolean;
  children?: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

const Button = ({ children, rounded, className, ...props }: ButtonProps) => {
  const buttonStyle = useMemo(() => {
    switch (props.mode) {
      case "primary":
        return " text-white";
      case "primaryContained":
        return "bg-white bg-opacity-20 text-white border-[0.7px] border-solid border-white box-shadow btn";
      case "primaryOutline":
        return "bg-black bg-opacity-20 text-white border-[0.7px] border-solid border-white box-shadow btn";
      case "secondary":
        return "text-white";
      case "secondaryContained":
        return "bg-black text-white";
      case "secondaryOutline":
        return "bg-black bg-opacity-20 text-white border-[0.7px] border-solid border-white box-shadow btn";
      case "secondaryBorder":
        return "text-black border-black border-[0.7px] border-solid";
      default:
        return "text-[#55657e] ";
    }
  }, [props.mode]);

  return (
    <button
      {...props}
      className={clsx(
        "font-semibold py-2 px-4 !cursor-pointer",
        buttonStyle,
        rounded && "rounded-full",
        className // Include className from props
      )}
    >
      {children}
    </button>
  );
};

export default Button;
