import { MetaMaskInpageProvider } from "@metamask/providers";

declare global {
  interface Window {
    ethereum?: MetaMaskInpageProvider;
  }
}
declare global {
  interface MetaMaskEthereumProvider extends EthereumProvider {
    request: (request: {
      method: string;
      params?: unknown[];
    }) => Promise<unknown>;
  }
}

declare module "*.svg" {
  const content: string;
  export default content;
}

declare function requireContext(
  directory: string,
  useSubdirectories?: boolean,
  regExp?: RegExp
): {
  keys: () => string[];
  (id: string): { default: string };
};

interface NodeRequire {
  context: typeof requireContext;
}

declare global {
  interface Window {
    p5: any;
  }
}
