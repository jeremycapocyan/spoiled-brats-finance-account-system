import type { NextConfig } from "next";
const config: NextConfig = {
  outputFileTracingIncludes: { "/api/reports": ["./public/fonts/*"], "/app-icons/[size]": ["./public/brand/logo-original.png"] },
  poweredByHeader: false,
};
export default config;
