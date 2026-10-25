import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AppShell } from "@/components/layout/app-shell";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://geo-probe.youerning.top"),
  title: {
    default: "GEO Probe — AI 搜索品牌提及检测",
    template: "%s · GEO Probe",
  },
  description:
    "开源的 GEO 品牌提及检测工具：批量向 DeepSeek 提问，检测 AI 回答中是否出现你的公司/产品名，追踪竞品声量与检索来源。纯静态部署，数据只存浏览器本地。",
  keywords: [
    "GEO",
    "生成式引擎优化",
    "AI 搜索优化",
    "AEO",
    "品牌提及",
    "DeepSeek",
    "引用检测",
  ],
  authors: [{ name: "深圳市元构场智能科技有限公司", url: "https://www.yuangouchang.com" }],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "GEO Probe — AI 搜索品牌提及检测",
    description:
      "批量向 AI 提问，看看它会不会提到你的品牌。追踪竞品声量、检索来源和官网可见度。",
    url: "https://geo-probe.youerning.top",
    siteName: "GEO Probe",
    locale: "zh_CN",
    type: "website",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "GEO Probe — AI 搜索品牌提及检测",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "GEO Probe — AI 搜索品牌提及检测",
    description: "批量向 AI 提问，看看它会不会提到你的品牌。",
    images: ["/og.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="zh-CN"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <ThemeProvider>
          <TooltipProvider>
            <AppShell>{children}</AppShell>
          </TooltipProvider>
          <Toaster position="top-center" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
