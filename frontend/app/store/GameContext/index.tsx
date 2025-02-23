"use client";
import moment from "moment";
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import Modal from "../../components/Modal";
import Button from "../../components/Button";
import { useRouter, usePathname } from "next/navigation";
import ShareModal from "./components/ShareModal";

interface GameContextType {
  gameTime: number;
  setGameTime: React.Dispatch<React.SetStateAction<number>>;
  currentDate: number;
  lastWateredTime: number;
  setLastWateredTime: React.Dispatch<React.SetStateAction<number>>;
  goalWaterTime: React.RefObject<number>;
  gameStartTime: React.RefObject<number>;
  waterLevel: number;
  isFalling: boolean;
  isHitGoal: boolean;
  setIsHitGoal: React.Dispatch<React.SetStateAction<boolean>>;
  setShowInscription: React.Dispatch<React.SetStateAction<boolean>>;
  setShowShareModal: React.Dispatch<React.SetStateAction<boolean>>;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const useGameContext = () => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error("useGameContext must be used within a GameProvider");
  }
  return context;
};

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const cycleLength = 24 * 60 * 60 * 1000 * 7;
  const router = useRouter();
  const pathname = usePathname();
  const currentDate = moment().subtract(10, "day").valueOf();
  const [gameTime, setGameTime] = useState(currentDate);
  const [lastWateredTime, setLastWateredTime] = useState(currentDate);
  const goalWaterTime = useRef(moment(currentDate).add(60, "days").valueOf());
  const gameStartTime = useRef(currentDate);
  const [isFalling, setIsFalling] = useState(false);
  const [isHitGoal, setIsHitGoal] = useState(false);
  const [showInscription, setShowInscription] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [seedName, setSeedName] = useState("");

  let interval = useRef<NodeJS.Timeout | null>(null);
  const waterLevel = useMemo(() => {
    return Math.max(
      0,
      100 - ((gameTime - lastWateredTime) / cycleLength / 2) * 100
    );
  }, [gameTime, lastWateredTime, cycleLength]);

  useEffect(() => {
    if (waterLevel === 0 && interval.current) {
      setIsFalling(true);
      clearInterval(interval.current);
      interval.current = null;
    }
  }, [waterLevel, isFalling]);

  const handleRestart = useCallback(() => {
    const newStartDate = moment().subtract(1, "day").valueOf();
    setIsFalling(false);
    setGameTime(newStartDate);
    setLastWateredTime(newStartDate);
    goalWaterTime.current = moment(newStartDate).add(60, "days").valueOf();
    gameStartTime.current = newStartDate;
    startGameInterval();
  }, []);

  const startGameInterval = useCallback(() => {
    const millisecondsPerGameDay = 100;
    interval.current = setInterval(() => {
      setGameTime((prevGameTime) => {
        const newGameTime = prevGameTime + (24 * 60 * 60 * 1000) / 15;
        const sixtyDaysFromStart = currentDate + 60 * 24 * 60 * 60 * 1000;

        if (newGameTime >= sixtyDaysFromStart) {
          setIsHitGoal(true);
          setIsFalling(false);
          clearInterval(interval.current);
          interval.current = null;
          return sixtyDaysFromStart;
        }

        return newGameTime;
      });
    }, millisecondsPerGameDay);
  }, [currentDate, setIsHitGoal, setIsFalling]);

  useEffect(() => {
    if (pathname === "/try") {
      startGameInterval();
    } else {
      clearInterval(interval.current);
      interval.current = null;
      resetGame();
    }
    return () => clearInterval(interval.current);
  }, [pathname]);

  const resetGame = useCallback(() => {
    setIsFalling(false);
    setGameTime(currentDate);
    setLastWateredTime(currentDate);
  }, [currentDate]);

  const handleCloseShareModal = useCallback(() => {
    setShowShareModal(false);
  }, []);

  return (
    <GameContext.Provider
      value={{
        gameTime,
        setGameTime,
        currentDate,
        lastWateredTime,
        setLastWateredTime,
        goalWaterTime,
        gameStartTime,
        waterLevel,
        isFalling,
        isHitGoal,
        setIsHitGoal,
        setShowInscription,
        setShowShareModal,
      }}
    >
      {children}
      <Modal
        blur
        size="xl"
        title="We're sorry"
        show={isFalling}
        onClose={() => {
          setIsFalling(false);
          setGameTime(currentDate);
          setLastWateredTime(currentDate);
          startGameInterval();
        }}
        footer={
          <div className="flex justify-around gap-6">
            <Button
              mode="secondaryOutline"
              className="w-[180px] h-[54px] sm:w-[120px] sm:h-[44px] md:w-[120px] md:h-[44px] !bg-transparent border-black !text-black"
              rounded
              onClick={() => {
                setIsFalling(false);
                setGameTime(currentDate);
                setLastWateredTime(currentDate);

                router.push("/seed");
              }}
            >
              Back
            </Button>
            <Button
              mode="secondaryContained"
              className="w-[180px] h-[54px] sm:w-[120px] sm:h-[44px] md:w-[120px] md:h-[44px] relative overflow-hidden"
              rounded
              onClick={handleRestart}
            >
              <span className="relative z-10 animate-pulse">Play again</span>
            </Button>
          </div>
        }
      >
        <div className="flex w-full items-center justify-center min-h-[47px]  text-black leading-[24px] ">
          <p className="text-center flex items-center justify-center w-full max-w-[350px] sm:text-sm md:text-sm">
            Your Lifetree has died,
            <br /> Cherish each unique life you nurture.
          </p>
        </div>
      </Modal>

      <Modal
        size="xl"
        blur
        title="Inscribe your name on your immortal LifeTree!"
        show={showInscription}
        titleClassName="!text-[34px] sm:!text-[18px] md:!text-[18px]"
        closeable={false}
        onClose={() => setShowInscription(false)}
        footer={
          <Button
            mode="secondaryContained"
            className="w-[180px] h-[54px] sm:w-[120px] sm:h-[44px] md:w-[120px] md:h-[44px] relative overflow-hidden"
            rounded
            onClick={() => {
              setShowInscription(false);
              setShowShareModal(true);
            }}
          >
            <span className="relative z-10 animate-pulse">Inscribe</span>
          </Button>
        }
      >
        <div className="flex flex-col gap-4 rounded-full items-center mt-10 mb-5">
          <input
            className="lg:w-[401px] w-full h-[54px] px-10 outline-none border-none bg-white rounded-full text-black text-center"
            type="text"
            placeholder={`Your Name`}
            style={{
              boxShadow: "0px 0px 10px 0px rgba(255, 255, 255, 0.3)",
            }}
            value={seedName}
            onChange={(e) => setSeedName(e.target.value)}
          />
        </div>
      </Modal>

      <ShareModal
        blur
        show={showShareModal}
        seedName={seedName}
        onClose={handleCloseShareModal}
        size="4xl"
        className="lg:!p-2 xl:!p-2"
      />
    </GameContext.Provider>
  );
};
