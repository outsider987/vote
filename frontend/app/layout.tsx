import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import RootContextProvider from "./store";
import clsx from "clsx";
import NavBar from "./layouts/NavBar";
import MyWagmiProvider from "./Provide/MyWagmiProvider";
import 'react-datepicker/dist/react-datepicker.css';


const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "vote",
  description:
    "vote",
  metadataBase: new URL("https://lifetime.cx"), // Replace with your actual domain
  
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.4.0/p5.js"></script>
        <script src="https://unpkg.com/p5.js-svg@1.5.1"></script>
      </head>
      <MyWagmiProvider>
        <RootContextProvider>
          <body
            suppressHydrationWarning
            className={clsx(inter.className, "h-[100dvh]")}
          >
            {/* <Header className="z-20" /> */}
            <NavBar className={"z-20"} />
            <div className="w-full overflow-x-hidden max-w-[1920px] mx-auto min-h-[calc(100dvh)] pt-[76px]">
              {children}
            </div>
          </body>
        </RootContextProvider>
      </MyWagmiProvider>
    </html>
  );
}
