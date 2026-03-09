import { useEffect } from "react";
import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useAuthStore } from "@/store/useAuthStore";

export default function App({ Component, pageProps }: AppProps) {
  const checkAuth = useAuthStore((s) => s.checkAuth);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return <Component {...pageProps} />;
}
