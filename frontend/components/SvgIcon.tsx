import clsx from "clsx";
import React from "react";

const SVGIcon = ({ name, className = "", ...props }) => {
  const renderSvg = (name) => {
    switch (name) {
      case "seed":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 62 62"
            fill="none"
          >
            <g filter="url(#filter0_d_1003_9868)">
              <path
                d="M31 51C42.0457 51 51 42.0457 51 31C51 19.9543 42.0457 11 31 11C19.9543 11 11 19.9543 11 31C11 42.0457 19.9543 51 31 51Z"
                fill="white"
                fill-opacity="0.2"
                shape-rendering="crispEdges"
              />
              <path
                d="M31 51C42.0457 51 51 42.0457 51 31C51 19.9543 42.0457 11 31 11C19.9543 11 11 19.9543 11 31C11 42.0457 19.9543 51 31 51Z"
                stroke="white"
                stroke-width="0.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                shape-rendering="crispEdges"
              />
            </g>
            <path
              d="M21.069 22.0283C20.3983 27.6565 24.6892 32.0767 30.9074 32.1737C30.9841 27.1959 27.9579 21.5515 21.069 22.0283Z"
              stroke="white"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M30.8828 32.0684V44.2084"
              stroke="white"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M40.9414 22.0283C41.6121 27.6565 37.3212 32.0767 31.103 32.1737C31.0262 27.1959 34.0525 21.5515 40.9414 22.0283Z"
              stroke="white"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <defs>
              <filter
                id="filter0_d_1003_9868"
                x="0.75"
                y="0.75"
                width="60.5"
                height="60.5"
                filterUnits="userSpaceOnUse"
                color-interpolation-filters="sRGB"
              >
                <feFlood flood-opacity="0" result="BackgroundImageFix" />
                <feColorMatrix
                  in="SourceAlpha"
                  type="matrix"
                  values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                  result="hardAlpha"
                />
                <feOffset />
                <feGaussianBlur stdDeviation="5" />
                <feComposite in2="hardAlpha" operator="out" />
                <feColorMatrix
                  type="matrix"
                  values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.3 0"
                />
                <feBlend
                  mode="normal"
                  in2="BackgroundImageFix"
                  result="effect1_dropShadow_1003_9868"
                />
                <feBlend
                  mode="normal"
                  in="SourceGraphic"
                  in2="effect1_dropShadow_1003_9868"
                  result="shape"
                />
              </filter>
            </defs>
          </svg>
        );

      case "home":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="62"
            height="62"
            viewBox="0 0 62 62"
            fill="none"
          >
            <g filter="url(#filter0_d_692_55992)">
              <path
                d="M31 51C42.0457 51 51 42.0457 51 31C51 19.9543 42.0457 11 31 11C19.9543 11 11 19.9543 11 31C11 42.0457 19.9543 51 31 51Z"
                fill="white"
                fill-opacity="0.2"
                shape-rendering="crispEdges"
              />
              <path
                d="M31 51C42.0457 51 51 42.0457 51 31C51 19.9543 42.0457 11 31 11C19.9543 11 11 19.9543 11 31C11 42.0457 19.9543 51 31 51Z"
                stroke="white"
                stroke-width="0.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                shape-rendering="crispEdges"
              />
            </g>
            <path
              d="M29.1777 20.4258H36.9232C38.2808 20.4258 39.3798 21.5248 39.3798 22.8823V39.1126C39.3798 40.4702 38.2808 41.5692 36.9232 41.5692H29.1777"
              stroke="white"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M26.6081 36.6078L21 30.9997L26.6081 25.3916"
              stroke="white"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M21.0273 30.9995H32.6273"
              stroke="white"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <defs>
              <filter
                id="filter0_d_692_55992"
                x="0.75"
                y="0.75"
                width="60.5"
                height="60.5"
                filterUnits="userSpaceOnUse"
                color-interpolation-filters="sRGB"
              >
                <feFlood flood-opacity="0" result="BackgroundImageFix" />
                <feColorMatrix
                  in="SourceAlpha"
                  type="matrix"
                  values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                  result="hardAlpha"
                />
                <feOffset />
                <feGaussianBlur stdDeviation="5" />
                <feComposite in2="hardAlpha" operator="out" />
                <feColorMatrix
                  type="matrix"
                  values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.3 0"
                />
                <feBlend
                  mode="normal"
                  in2="BackgroundImageFix"
                  result="effect1_dropShadow_692_55992"
                />
                <feBlend
                  mode="normal"
                  in="SourceGraphic"
                  in2="effect1_dropShadow_692_55992"
                  result="shape"
                />
              </filter>
            </defs>
          </svg>
        );

      default:
        break;
    }
  };

  return (
    <span className={clsx("inline-block", className)}>{renderSvg(name)}</span>
  );
};

export default SVGIcon;
