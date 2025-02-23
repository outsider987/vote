"use client";

import React, { useState, useEffect, useRef } from "react";
import { memo } from 'react';

// Cache object to store loaded SVGs
const svgCache = new Map();

const SvgLoader = ({ name, subfolder = "", className = "" }) => {
  const [svgContent, setSvgContent] = useState(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    const loadSvg = async () => {
      // Build the full path including the subfolder
      const svgPath = subfolder
        ? `/svgs/${subfolder}/${name}.svg`
        : `/svgs/${name}.svg`;

      // Check if the SVG is already in the cache
      if (svgCache.has(svgPath)) {
        setSvgContent(svgCache.get(svgPath));
        return;
      }

      try {
        const response = await fetch(svgPath);
        if (response.ok) {
          const text = await response.text();
          // Store in cache
          svgCache.set(svgPath, text);
          if (isMounted.current) {
            setSvgContent(text);
          }
        } else {
          console.error(`SVG file ${name}.svg not found in ${subfolder}`);
        }
      } catch (error) {
        console.error("Error loading SVG:", error);
      }
    };

    loadSvg();
  }, [name, subfolder]);

  if (!svgContent) {
    return null; // or a loading indicator
  }

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
};

export default memo(SvgLoader);
