"use client";
import React from "react";
import Arrow from "@/app/assets/svgs/arrow.svg";
import Share from "@/app/assets/svgs/share.svg";
import Link from "@/app/assets/svgs/share/link.svg";
import Logo from "@/app/assets/svgs/Home/logo.svg";
import OpenSea from "@/app/assets/svgs/Home/opensea.svg";
import X from "@/app/assets/svgs/Home/x.svg";
import Discord from "@/app/assets/svgs/Home/discord.svg";
import Back from "@/app/assets/svgs/back.svg";
import Seed from "@/app/assets/svgs/seed.svg";
import Tree from "@/app/assets/svgs/tree.svg";
import SeedActive from "@/app/assets/svgs/seed-active.svg";
import TreeActive from "@/app/assets/svgs/tree-active.svg";
import OutlineArrow from "@/app/assets/svgs/outline-arrow.svg";
function Icon({ name, className = "", ...props }) {
  switch (name) {
    case "arrow":
      return <Arrow className={className} {...props} />;
    case "outline-arrow":
      return <OutlineArrow className={className} {...props} />;
    case "share":
      return <Share className={className} {...props} />;
    case "logo":
      return <Logo className={className} {...props} />;
    case "opensea":
      return <OpenSea className={className} {...props} />;
    case "x":
      return <X className={className} {...props} />;
    case "discord":
      return <Discord className={className} {...props} />;
    case "link":
      return <Link className={className} {...props} />;
    case "back":
      return <Back className={className} {...props} />;
    case "seed":
      return <Seed className={className} {...props} />;
    case "tree":
      return <Tree className={className} {...props} />;
    case "seed-active":
      return <SeedActive className={className} {...props} />;
    case "tree-active":
      return <TreeActive className={className} {...props} />;
    default:
      return null;
  }
}

export default Icon;
