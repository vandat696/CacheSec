import type { NextConfig } from "next";

const config: NextConfig = {
  async headers() {
    return [{ source: "/workspace", headers: [
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
      { key: "Referrer-Policy", value: "no-referrer" },
    ] }];
  },
};
export default config;
