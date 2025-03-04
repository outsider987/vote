"use client"; // Add this to ensure it's a Client Component

import { SnackbarProvider } from "notistack";
import { ReactNode } from "react";

const MySnackbarProvider = ({ children }: { children: ReactNode }) => {
  return <SnackbarProvider maxSnack={3}>{children}</SnackbarProvider>;
};

export default MySnackbarProvider;
