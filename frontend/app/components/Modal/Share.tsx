import Modal, { ModalProps } from ".";
import SvgLoader from "../SvgLoader";
import DynamicSvgIcon from "@/app/components/DynamicSvgIcon";

const ShareModal = (props: ModalProps) => {
  const links = [
    {
      name: "Twitter",
      svg: {
        subpath: "share",
        path: "x",
      },
      url: "https://x.com/share?text=Check%20this%20out!", // Add your content here
    },
    // {
    //   name: "logo",
    //   svg: {
    //     subpath: "share",
    //     path: "logo",
    //   },
    //   url: "https://twitter.com/life_seed",
    // },
    {
      name: "OpenSea",
      svg: {
        subpath: "share",
        path: "opensea",
      },
      url: "https://opensea.io/collection/lifetime-access-pass",
    },
    {
      name: "link",
      svg: {
        subpath: "share",
        path: "link",
      },
      url: "https://x.com/life_seed",
    },
  ];

  return (
    <Modal {...props}>
      <div className="flex items-center justify-center gap-4">
        {links.map((link, index) => (
          <a
            key={index}
            className="cursor-pointer"
            href={link.url}
            target="_blank"
          >
            <DynamicSvgIcon name={link.svg.path} subfolder={link.svg.subpath} />
          </a>
        ))}
      </div>
    </Modal>
  );
};

export default ShareModal;
