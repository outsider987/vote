import Modal from "@/app/components/Modal";
import DynamicSvgIcon from "@/app/components/DynamicSvgIcon";
import { memo, useCallback, useMemo, useRef } from "react";
import ShareCard from "./ShareCard";
// import html2canvas from "html2canvas";
import { useRouter } from "next/navigation";

interface ShareModalProps {
  show: boolean;
  onClose: () => void;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl";
  className?: string;
  seedName: string;
  blur?: boolean;
}

const ShareModal = memo(
  ({
    show,
    onClose,
    size = "md",
    className,
    seedName,
    blur = false,
  }: ShareModalProps) => {
    const shareCardRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    const shareOnTwitter = useCallback(async () => {
      //   const canvas = await html2canvas(shareCardRef.current);
      //   const imageData = canvas.toDataURL("image/png");

      try {
        // Send the image data to your backend
        // const response = await fetch("/api/share-twitter", {
        //   method: "POST",
        //   headers: {
        //     "Content-Type": "application/json",
        //   },
        //   body: JSON.stringify({ imageData }),
        // });

        // const data = await response.json();

        const twitterShareText = encodeURIComponent(
          `${seedName} just successfully planted their very own LifeTree on LIFETIME!`
        );
        const twitterShareUrl = encodeURIComponent(window.location.origin);

        // Use the mediaId returned from the backend
        const twitterIntent = `https://twitter.com/intent/tweet?openExternalBrowser=1&text=${twitterShareText}&url=${twitterShareUrl}`;

        // Open Twitter share window
        // window.open(
        //   twitterIntent,
        //   "_self"
        // );
        // router.push(twitterIntent.replace("_self", "_blank"));
        // alert(twitterIntent);
        router.push(twitterIntent);
      } catch (error) {
        console.error("Error sharing on Twitter:", error);
        // Fallback to sharing without image
        const twitterShareText = encodeURIComponent(
          `${seedName} just successfully planted their very own LifeTree on LIFETIME!`
        );
        const twitterShareUrl = encodeURIComponent(window.location.origin);
        const twitterIntent = `https://twitter.com/intent/tweet?openExternalBrowser=1&text=${twitterShareText}&url=${twitterShareUrl}`;
        window.open(twitterIntent);
      }
    }, [seedName]);

    const ShareIcon = useCallback(
      ({ name, onClick }: { name: string; onClick: () => void }) => (
        <div onClick={onClick} className="cursor-pointer">
          <DynamicSvgIcon
            className="cursor-pointer"
            subfolder="share"
            name={name}
          />
        </div>
      ),
      []
    );

    const MemoizedShareIcon = useMemo(() => memo(ShareIcon), [ShareIcon]);

    return (
      <Modal
        show={show}
        onClose={onClose}
        size={size}
        className={className}
        blur={blur}
      >
        {/* desktop */}
        <div className="grid grid-cols-10 min-h-[500px] w-full h-full sm:hidden md:hidden">
          <ShareCard
            seedName={seedName}
            ref={shareCardRef}
            className="h-full col-span-6"
          />
          <div className="flex flex-col justify-center items-center col-span-4">
            <h1 className="text-black text-[34px] font-semibold tracking-wider mb-2">
              Share
            </h1>
            <p className="text-black max-w-[270px] text-center leading-6">
              {`${seedName} just successfully planted their very own LifeTree on LIFETIME!`}
            </p>
            <div className="flex justify-center gap-4 items-center h-[50px] mt-10">
              <MemoizedShareIcon onClick={shareOnTwitter} name="x" />

              {/* <MemoizedShareIcon onClick={() => {}} name="link" /> */}
            </div>
          </div>
        </div>

        {/* mobile */}
        <div className="flex-col items-center justify-center hidden sm:flex md:flex">
          <h1 className="text-black text-[34px] sm:text-[24px] md:text-[24px] font-semibold tracking-wider mb-5 sm:mb-3 md:mb-3">
            Share
          </h1>
          <ShareCard seedName={seedName} ref={shareCardRef} className="mb-7" />
          <p className="text-black leading-[20px] text-center text-sm max-w-[240x] ">
            {`${seedName} just successfully planted their very own LifeTree on LIFETIME!`}
          </p>
          <div className="flex justify-center gap-10 items-center h-[50px] mt-[36px]">
            <MemoizedShareIcon onClick={shareOnTwitter} name="x" />
            {/* <MemoizedShareIcon onClick={() => {}} name="link" /> */}
          </div>
        </div>
      </Modal>
    );
  }
);

ShareModal.displayName = "ShareModal";

export default ShareModal;
