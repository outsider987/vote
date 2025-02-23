"use client";
import React, { useState, useRef } from "react";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";

const Carousel = ({
  images,
  children,
}: {
  images?: string[];
  children?: React.ReactNode;
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  // Ensure only one of images or children is used
  const isImagesMode = images && images.length > 0;
  const itemCount = isImagesMode
    ? images.length
    : React.Children.count(children);

  const prevSlide = () => {
    setCurrentIndex((prevIndex) => (prevIndex - 1 + itemCount) % itemCount);
  };

  const nextSlide = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % itemCount);
  };

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current - touchEndX.current > 50) {
      nextSlide();
    }

    if (touchStartX.current - touchEndX.current < -50) {
      prevSlide();
    }
  };

  return (
    <div className="relative w-full max-w-4xl mx-auto">
      <div
        className="overflow-hidden flex rounded-3xl"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="flex transition-transform duration-300"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {isImagesMode
            ? images.map((src, index) => (
                <div
                  key={index}
                  className="min-w-full h-full flex justify-center items-center"
                >
                  <img
                    src={src}
                    alt={`Slide ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))
            : React.Children.map(children, (child, index) => (
                <div
                  key={index}
                  className="min-w-full h-full flex justify-center items-center"
                >
                  {child}
                </div>
              ))}
        </div>
      </div>
      <button
        onClick={prevSlide}
        className="absolute bg-opacity-50 rotate-180 left-0 top-1/2 transform -translate-y-1/2 bg-gray-800 text-white p-2 rounded-full hover:bg-gray-600 focus:outline-none"
      >
        <ArrowForwardIcon />
      </button>
      <button
        onClick={nextSlide}
        className="absolute bg-opacity-50 right-0 top-1/2 transform -translate-y-1/2 bg-gray-800 text-white p-2 rounded-full hover:bg-gray-600 focus:outline-none"
      >
        <ArrowForwardIcon />
      </button>
      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 flex space-x-2 p-2">
        {Array.from({ length: itemCount }).map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`w-3 h-3 rounded-full ${
              index === currentIndex ? "bg-gray-600" : "bg-gray-300"
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default Carousel;
