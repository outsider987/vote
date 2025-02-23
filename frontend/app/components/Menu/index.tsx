import MenuIcon from "@mui/icons-material/Menu";
import { useState, useEffect, TouchEvent } from "react";

const Menu = () => {
  const menuItems = [
    // {
    //   label: "Seeds",
    //   href: "/seeds",
    // },
    // {
    //   label: "Trial",
    //   href: "/seed",
    // },
  ];

  const [show, setShow] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Handle touch events
  const handleTouchStart = (e: TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientY);
  };

  const handleTouchMove = (e: TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientY);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    // If scrolled down more than 50px, hide the menu
    const distance = touchStart - touchEnd;

    if (distance < 0) {
      setShow(false);
    }

    // Reset values
    setTouchStart(null);
    setTouchEnd(null);
  };

  return (
    <div className="ml-4">
      <div className="flex items-center gap-5 sm:hidden md:hidden">
        {menuItems.map((item) => (
          <a
            className="text-[#9B9B9B] hover:text-white text-xl"
            key={item.label}
            href={item.href}
          >
            {item.label}
          </a>
        ))}
      </div>
      <div className="lg:hidden xl:hidden 2xl:hidden">
        <div className="flex items-center gap-5 relative">
          <MenuIcon onClick={() => setShow(!show)} />
          <div
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className={`fixed z-50 space-y-3 inset-x-0 bottom-0 w-full bg-[#141414] rounded-t-2xl flex flex-col p-8 transition-transform duration-300 ${
              show ? "translate-y-0" : "translate-y-full"
            }`}
          >
            {menuItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="text-[#9B9B9B] hover:text-white text-xl"
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Menu;
