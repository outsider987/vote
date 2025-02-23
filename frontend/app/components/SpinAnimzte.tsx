import clsx from "clsx";

export default function SpinAnimate({
  className,
  stopSpin = false,
}: {
  className?: string;
  stopSpin?: boolean;
}) {
  return (
    <div
      className={clsx("absolute w-full h-full left-0 max-w-[100vw]", className)}
      style={{
        filter: "blur(100px)",
        pointerEvents: "none",
        zIndex: 0,
        opacity: 0.8,
        transform: `scale(1)`,
      }}
    >
      <div className="absolute top-1/2 left-1/2 w-full h-full transform -translate-x-1/2 -translate-y-1/2">
        <div className="absolute rounded-full top-1/2 left-1/2 w-screen h-screen min-w-screen transform -translate-x-1/2 -translate-y-1/2 overflow-hidden">
          <div
            className={clsx(
              "absolute top-1/2 left-1/2 w-screen h-screen transform -translate-x-1/2 -translate-y-1/2 bg-conic-gradient ",
              stopSpin ? "animate-none" : "animate-spin-slow"
            )}
          ></div>
        </div>
      </div>
    </div>
  );
}
