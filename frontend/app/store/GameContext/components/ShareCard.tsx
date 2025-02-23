import DarkSeed from "@/public/images/dark-seed.png";
import ShareBg from "@/public/images/share-bg.png";
import ShareTree from "@/public/images/share-tree.png";
import clsx from "clsx";
import { forwardRef } from "react";

interface ShareCardProps {
  className?: string;
  seedName: string;
}

const ShareCard = forwardRef<HTMLDivElement, ShareCardProps>(
  ({ className, seedName }, ref) => {
    return (
      <div
        ref={ref}
        className={clsx("  rounded-xl", className)}
        // style={{ boxShadow: "0px 0px 20px 3px #FFFFFF66 inset" }}
      >
        <div className="grid grid-cols-12 grid-rows-12 h-full  p-4 sm:w-[250px] sm:h-[250px] relative sm:min-h-[250px] md:min-h-[250px] sm:min-w-[250px] md:min-w-[250px]">
          <div className="absolute top-0 left-0 w-full h-full ">
            {/* <img
              src={ShareBg.src}
              alt="share-bg"
              // className="w-full h-full relative z-10 rounded-3xl bg-[center_bottom_calc(100px)] sm:bg-[center_bottom_calc(50px)] md:bg-[center_bottom_calc(50px)]"
              style={{
                backgroundImage: `url(${ShareTree.src})`,
                backgroundSize: "100% auto",
                backgroundRepeat: "no-repeat",
              }}
            /> */}
            <img
              src={ShareTree.src}
              alt="share-bg"
              className="rounded-3xl w-full h-full"

              // className="w-full h-full relative z-10 rounded-3xl bg-[center_bottom_calc(100px)] sm:bg-[center_bottom_calc(50px)] md:bg-[center_bottom_calc(50px)]"
              style={{
                backgroundImage: `url(${ShareTree.src})`,
                backgroundSize: "100% auto",
                backgroundRepeat: "no-repeat",
              }}
            />
            <span className="text-[#444444] w-[62%] tracking-wider leading-[29px] text-xs sm:text-[8px] md:text-[8px] z-10 absolute  left-6 bottom-8 sm:left-3 sm:bottom-2 md:left-3 md:bottom-2">
              LifeTree ♾️ {seedName}
            </span>
          </div>

          {/* <div className=" absolute right-[9%] bottom-[10%] z-10">
            <img
              src={DarkSeed.src}
              alt="dark-seed"
              className="w-[110px] h-[110px] sm:w-[55px] sm:h-[55px] md:w-[55px] md:h-[55px] "
            />
          </div> */}

          {/*  */}
          <div className="col-span-8 row-span-10  rounded-t-[45px]"></div>
          <div className="col-span-4 row-span-2  rounded-tr-[45px]"></div>
          <div className="col-span-4 row-span-6  rounded-tr-[45px]"></div>
          <div className="col-span-8 row-span-4  rounded-bl-[70px]">
            <div className="flex justify-center items-center h-full">
              <span className="text-black tracking-wider leading-[29px] text-xs z-10">
                {/* LifeTree ♾️ {seedName} 987897 */}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

ShareCard.displayName = "ShareCard";

export default ShareCard;
