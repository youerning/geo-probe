"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ExternalLink,
  Code2,
  History,
  LayoutDashboard,
  ListChecks,
  Loader2,
  Menu,
  Play,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { ProjectSwitcher } from "@/components/layout/project-switcher";
import { DemoBanner } from "@/components/layout/demo-banner";
import { ensureDemoSeed } from "@/lib/demo/seed";
import { useAppStore } from "@/lib/hooks/use-app-store";
import { useProject, useProjects } from "@/lib/hooks/use-data";
import { APP_VERSION, COMPANY_NAME, COMPANY_URL, GITHUB_URL } from "@/lib/config";

const NAV_ITEMS = [
  { href: "/", label: "概览", icon: LayoutDashboard },
  { href: "/prompts", label: "提示词", icon: ListChecks },
  { href: "/run", label: "运行探测", icon: Play },
  { href: "/runs", label: "历史批次", icon: History },
  { href: "/settings", label: "设置", icon: Settings },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-0.5">
      {NAV_ITEMS.map((item) => {
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const projects = useProjects();

  return (
    <div className="flex h-full flex-col gap-4 p-3">
      <div className="px-1 pt-1">
        <Logo />
      </div>

      <div className="space-y-2">
        <ProjectSwitcher />
        <div className="flex items-center justify-between px-1 text-[10px] text-muted-foreground">
          <span>{projects?.length ?? 0} 个项目</span>
          <span className="inline-flex items-center gap-1">
            <ShieldCheck className="size-3" />
            本地存储
          </span>
        </div>
      </div>

      <Separator />
      <NavLinks onNavigate={onNavigate} />

      <div className="mt-auto space-y-3">
        <div className="rounded-lg border bg-muted/30 p-3 text-[11px] leading-5 text-muted-foreground">
          数据只存在你的浏览器。没有后端，没有遥测。
        </div>
        <div className="flex items-center justify-between px-1">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <Code2 className="size-3.5" />
            GitHub
            <ExternalLink className="size-3" />
          </a>
          <ThemeToggle />
        </div>
        <div className="space-y-1 px-1 text-[10px] leading-4 text-muted-foreground">
          <div className="flex items-center gap-1">
            <BarChart3 className="size-3" />
            v{APP_VERSION} · MIT
          </div>
          <a
            href={COMPANY_URL}
            target="_blank"
            rel="noreferrer"
            className="block hover:text-foreground"
          >
            由 {COMPANY_NAME} 开源
          </a>
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const projects = useProjects();
  const selectedProjectId = useAppStore((state) => state.selectedProjectId);
  const setSelectedProjectId = useAppStore((state) => state.setSelectedProjectId);
  const hydrate = useAppStore((state) => state.hydrate);
  const hydrated = useAppStore((state) => state.hydrated);
  const selectedProject = useProject(selectedProjectId);
  const [seeding, setSeeding] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const seedAttempted = useRef(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated || projects === undefined) return;

    if (projects.length > 0) {
      setSeeding(false);
      if (!selectedProjectId || !projects.some((project) => project.id === selectedProjectId)) {
        setSelectedProjectId(projects[0].id);
      }
      return;
    }

    if (seedAttempted.current) {
      setSeeding(false);
      return;
    }

    seedAttempted.current = true;
    ensureDemoSeed()
      .then((project) => {
        if (project) setSelectedProjectId(project.id);
      })
      .catch(() => {
        // Demo data is optional; the onboarding screen handles the empty state.
      })
      .finally(() => setSeeding(false));
  }, [hydrated, projects, selectedProjectId, setSelectedProjectId]);

  const loading = projects === undefined || (seeding && !projects?.length);

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r bg-sidebar md:flex md:flex-col">
        <SidebarContent />
      </aside>

      <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b bg-background/90 px-3 backdrop-blur md:hidden">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="打开菜单"
          onClick={() => setMobileOpen(true)}
        >
          <Menu />
        </Button>
        <Logo compact />
        <div className="ml-auto flex items-center gap-1">
          {selectedProject?.isDemo && (
            <Badge variant="secondary" className="text-[10px]">
              示例
            </Badge>
          )}
          <ThemeToggle />
        </div>
      </header>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">导航</SheetTitle>
          <SidebarContent onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="md:pl-64">
        <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
          {loading ? (
            <div className="flex flex-1 items-center justify-center py-24">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                正在准备本地数据…
              </div>
            </div>
          ) : (
            <div className="flex-1 space-y-5">
              {selectedProject?.isDemo && !pathname.startsWith("/settings") && (
                <DemoBanner project={selectedProject} />
              )}
              {children}
            </div>
          )}

          <footer className="mt-10 flex flex-col gap-2 border-t pt-4 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>数据只存在浏览器 · v{APP_VERSION}</span>
              <span className="hidden sm:inline">·</span>
              <span>AI 引用 = 品牌提及，检索来源 ≠ 逐句引用</span>
            </div>
            <div className="flex items-center gap-3">
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer"
                className="hover:text-foreground"
              >
                GitHub
              </a>
              <a
                href={COMPANY_URL}
                target="_blank"
                rel="noreferrer"
                className="hover:text-foreground"
              >
                元构场
              </a>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
