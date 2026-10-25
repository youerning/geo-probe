"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Database,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FolderCog,
  Code2,
  Info,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { CompetitorEditor } from "@/components/competitor-editor";
import { DeleteProjectDialog } from "@/components/layout/delete-project-dialog";
import { PageHeader } from "@/components/page-header";
import {
  APP_VERSION,
  COMPANY_URL,
  DEMO_URL,
  DISCLAIMER,
  GITHUB_URL,
  MODEL_OPTIONS,
  PRIVACY_TEXT,
} from "@/lib/config";
import { getDb } from "@/lib/db";
import { clearUserData, listProjects, updateProject } from "@/lib/db/repositories";
import { deleteDemo, restoreDemo } from "@/lib/demo/seed";
import { downloadAllJson } from "@/lib/export/files";
import type { ExportBundle } from "@/lib/types";
import { useApiKey } from "@/lib/hooks/use-api-key";
import { useAppSettings } from "@/lib/hooks/use-app-settings";
import { useAppStore } from "@/lib/hooks/use-app-store";
import { useProject, useProjects } from "@/lib/hooks/use-data";
import {
  buildBrandTarget,
  draftsToTargets,
  formatBrandAliases,
  targetsToDrafts,
  type CompetitorDraft,
} from "@/lib/project-utils";
import { testDeepSeekKey } from "@/lib/providers/deepseek";

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
  actions,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="flex gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
            <Icon className="size-4" />
          </span>
          <div className="space-y-1">
            <CardTitle className="text-base">{title}</CardTitle>
            {description && <CardDescription className="text-xs leading-5">{description}</CardDescription>}
          </div>
        </div>
        {actions}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const selectedProjectId = useAppStore((state) => state.selectedProjectId);
  const setSelectedProjectId = useAppStore((state) => state.setSelectedProjectId);
  const projects = useProjects();
  const project = useProject(selectedProjectId);
  const apiKey = useApiKey();
  const { settings, save: saveSettings } = useAppSettings();

  const [keyInput, setKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [persistKey, setPersistKey] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [defaultModel, setDefaultModel] = useState(settings.defaultModel);
  const [maxTokens, setMaxTokens] = useState(String(settings.maxTokens));
  const [maxUses, setMaxUses] = useState(settings.maxUses);
  const [repeats, setRepeats] = useState(settings.repeats);
  const [concurrency, setConcurrency] = useState(settings.concurrency);
  const [customApiBase, setCustomApiBase] = useState(settings.customApiBase);

  const [projectName, setProjectName] = useState("");
  const [brandLabel, setBrandLabel] = useState("");
  const [brandAliases, setBrandAliases] = useState("");
  const [brandDomains, setBrandDomains] = useState("");
  const [competitors, setCompetitors] = useState<CompetitorDraft[]>([]);
  const [savingProject, setSavingProject] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!apiKey.loaded) return;
    setKeyInput(apiKey.key);
    setPersistKey(apiKey.persist);
  }, [apiKey.loaded, apiKey.key, apiKey.persist]);

  useEffect(() => {
    setDefaultModel(settings.defaultModel);
    setMaxTokens(String(settings.maxTokens));
    setMaxUses(settings.maxUses);
    setRepeats(settings.repeats);
    setConcurrency(settings.concurrency);
    setCustomApiBase(settings.customApiBase);
  }, [
    settings.defaultModel,
    settings.maxTokens,
    settings.maxUses,
    settings.repeats,
    settings.concurrency,
    settings.customApiBase,
  ]);

  useEffect(() => {
    if (!project) return;
    setProjectName(project.name);
    setBrandLabel(project.brand.label);
    setBrandAliases(formatBrandAliases(project.brand));
    setBrandDomains(project.brand.domains.join(", "));
    setCompetitors(targetsToDrafts(project.competitors));
  }, [project]);

  const handleSaveKey = () => {
    apiKey.save(keyInput, persistKey);
    setTestResult(null);
    toast.success("API Key 已保存。");
  };

  const handleTestKey = async () => {
    if (!keyInput.trim() && !customApiBase.trim()) {
      toast.error("先填写 API Key，或配置代理地址。");
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testDeepSeekKey({
        apiKey: keyInput.trim(),
        baseUrl: customApiBase.trim(),
        model: defaultModel,
      });
      setTestResult({ ok: result.ok, message: result.message });
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    } finally {
      setTesting(false);
    }
  };

  const handleSaveSettings = async () => {
    const tokens = Number(maxTokens);
    if (!Number.isFinite(tokens) || tokens < 256 || tokens > 32_000) {
      toast.error("max_tokens 建议在 256–32000 之间。");
      return;
    }
    await saveSettings({
      defaultModel,
      maxTokens: Math.round(tokens),
      maxUses,
      repeats,
      concurrency,
      customApiBase: customApiBase.trim(),
    });
    toast.success("默认参数已保存。");
  };

  const handleSaveProject = async () => {
    if (!project) return;
    if (!brandLabel.trim()) {
      toast.error("品牌名不能为空。");
      return;
    }
    setSavingProject(true);
    try {
      await updateProject(project.id, {
        name: projectName.trim() || `${brandLabel.trim()} GEO 监测`,
        brand: buildBrandTarget(brandLabel, brandAliases, brandDomains),
        competitors: draftsToTargets(competitors),
      });
      toast.success("项目设置已保存。");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败。");
    } finally {
      setSavingProject(false);
    }
  };

  const handleExportAll = async () => {
    const db = getDb();
    const [allProjects, prompts, runs, probes] = await Promise.all([
      listProjects(),
      db.prompts.toArray(),
      db.runs.toArray(),
      db.probes.toArray(),
    ]);
    downloadAllJson({ projects: allProjects, prompts, runs, probes });
    toast.success("已导出完整 JSON 备份。");
  };

  const handleImport = async (file?: File) => {
    if (!file) return;
    if (!window.confirm("导入会合并相同 ID 的项目、提示词、批次和探测。继续？")) return;

    try {
      const text = await file.text();
      const bundle = JSON.parse(text) as ExportBundle;
      if (
        !bundle ||
        !Array.isArray(bundle.projects) ||
        !Array.isArray(bundle.prompts) ||
        !Array.isArray(bundle.runs) ||
        !Array.isArray(bundle.probes)
      ) {
        throw new Error("文件格式不对，缺少 projects/prompts/runs/probes。");
      }

      const db = getDb();
      await db.transaction("rw", db.projects, db.prompts, db.runs, db.probes, async () => {
        await db.projects.bulkPut(bundle.projects);
        await db.prompts.bulkPut(bundle.prompts);
        await db.runs.bulkPut(bundle.runs);
        await db.probes.bulkPut(bundle.probes);
      });

      setSelectedProjectId(bundle.projects[0]?.id ?? null);
      toast.success(`已导入 ${bundle.projects.length} 个项目、${bundle.probes.length} 条探测。`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "导入失败。");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleClear = async () => {
    if (!window.confirm("清除所有本地数据？包括项目、提示词、批次和回答。API Key 也会被删除。")) return;
    await clearUserData();
    apiKey.clear();
    setSelectedProjectId(null);
    toast.success("本地数据已清除。");
    router.push("/");
  };

  const handleRestoreDemo = async () => {
    const demo = await restoreDemo();
    if (!demo) {
      toast.error("示例数据不可用。");
      return;
    }
    setSelectedProjectId(demo.id);
    toast.success("示例数据已恢复。");
  };

  const handleDeleteDemo = async () => {
    if (!window.confirm("删除示例项目？其他项目不受影响。")) return;
    await deleteDemo();
    if (project?.isDemo) setSelectedProjectId(null);
    toast.success("示例数据已删除。");
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="设置"
        title="设置"
        description="API Key、默认参数、项目和本地数据。所有设置都只保存在当前浏览器。"
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard
          icon={KeyRound}
          title="DeepSeek API Key"
          description="Key 只保存在浏览器里，并直接发送给 DeepSeek；不会经过 GEO Probe 的服务器。"
          actions={
            apiKey.key ? (
              <Badge variant="secondary" className="bg-emerald-500/12 text-emerald-600">
                已保存
              </Badge>
            ) : settings.customApiBase.trim() ? (
              <Badge variant="secondary" className="bg-chart-1/12 text-chart-1">
                代理模式
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                未设置
              </Badge>
            )
          }
        >
          <div className="space-y-2">
            <Label htmlFor="api-key">API Key</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="api-key"
                  type={showKey ? "text" : "password"}
                  value={keyInput}
                  onChange={(event) => setKeyInput(event.target.value)}
                  placeholder="sk-..."
                  className="pr-9 font-mono text-xs"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowKey((value) => !value)}
                  aria-label={showKey ? "隐藏 Key" : "显示 Key"}
                >
                  {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <Button onClick={handleSaveKey}>保存</Button>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <div className="text-sm font-medium">仅本次会话</div>
              <div className="text-[11px] text-muted-foreground">
                关闭浏览器后自动清除，适合共用电脑。
              </div>
            </div>
            <Switch
              checked={!persistKey}
              onCheckedChange={(checked) => setPersistKey(!checked)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={handleTestKey}
              disabled={testing || (!keyInput && !customApiBase.trim())}
            >
              {testing ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
              测试连接
            </Button>
            {apiKey.key && (
              <Button
                variant="ghost"
                onClick={() => {
                  apiKey.clear();
                  setKeyInput("");
                  setTestResult(null);
                  toast.success("API Key 已清除。");
                }}
              >
                <Trash2 />
                清除 Key
              </Button>
            )}
          </div>

          {testResult && (
            <Alert variant={testResult.ok ? "default" : "destructive"}>
              <AlertTitle>{testResult.ok ? "连接成功" : "连接失败"}</AlertTitle>
              <AlertDescription>{testResult.message}</AlertDescription>
            </Alert>
          )}

          <p className="text-[11px] leading-5 text-muted-foreground">
            获取 Key：DeepSeek 开放平台 → API Keys。Key 会以明文存在浏览器 localStorage（或 sessionStorage），
            请勿在公共电脑上长期保存。
          </p>
        </SectionCard>

        <SectionCard
          icon={FolderCog}
          title="默认运行参数"
          description="新建批次时的默认值，运行页仍可临时调整。"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="default-model">默认模型</Label>
              <NativeSelect
                id="default-model"
                value={defaultModel}
                onChange={(event) => setDefaultModel(event.target.value)}
              >
                {MODEL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="max-tokens">max_tokens</Label>
              <Input
                id="max-tokens"
                type="number"
                value={maxTokens}
                onChange={(event) => setMaxTokens(event.target.value)}
                min={256}
                max={32000}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="max-uses">最多搜索次数</Label>
              <NativeSelect
                id="max-uses"
                value={maxUses}
                onChange={(event) => setMaxUses(Number(event.target.value))}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="repeats">每条重复</Label>
              <NativeSelect
                id="repeats"
                value={repeats}
                onChange={(event) => setRepeats(Number(event.target.value))}
              >
                {[1, 2, 3, 4, 5].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="concurrency">并发</Label>
              <NativeSelect
                id="concurrency"
                value={concurrency}
                onChange={(event) => setConcurrency(Number(event.target.value))}
              >
                {[1, 2, 3].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="custom-base">自定义 API 地址（可选）</Label>
              <Input
                id="custom-base"
                value={customApiBase}
                onChange={(event) => setCustomApiBase(event.target.value)}
                placeholder="https://your-proxy.workers.dev"
                className="font-mono text-xs"
              />
              <p className="text-[11px] leading-5 text-muted-foreground">
                留空则浏览器直连 DeepSeek。填了代理地址后，应用会请求
                <code className="mx-1 rounded bg-muted px-1">{`{代理地址}/anthropic/v1/messages`}</code>
                ，由代理注入 Key。示例见仓库 `examples/cloudflare-worker-proxy`。
              </p>
            </div>
          </div>
          <Button onClick={handleSaveSettings}>保存默认参数</Button>
        </SectionCard>
      </div>

      <SectionCard
        icon={FolderCog}
        title="当前项目"
        description="品牌名、别名、官网域名和竞品。修改只影响以后的批次，历史批次使用运行时的快照。"
        actions={
          project ? (
            <Badge variant="outline" className="font-normal">
              {project.isDemo ? "示例项目" : "自定义项目"}
            </Badge>
          ) : null
        }
      >
        {!project ? (
          <div className="text-sm text-muted-foreground">
            还没有项目。<button className="text-primary underline-offset-2 hover:underline" onClick={() => router.push("/")}>去首页创建</button>。
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="project-name-setting">项目名</Label>
                <Input
                  id="project-name-setting"
                  value={projectName}
                  onChange={(event) => setProjectName(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="brand-label-setting">品牌/公司名</Label>
                <Input
                  id="brand-label-setting"
                  value={brandLabel}
                  onChange={(event) => setBrandLabel(event.target.value)}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="brand-aliases-setting">品牌别名</Label>
                <Textarea
                  id="brand-aliases-setting"
                  value={brandAliases}
                  onChange={(event) => setBrandAliases(event.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="brand-domains-setting">官网域名</Label>
                <Input
                  id="brand-domains-setting"
                  value={brandDomains}
                  onChange={(event) => setBrandDomains(event.target.value)}
                  placeholder="yuangouchang.com"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <div className="text-sm font-medium">竞品</div>
                <CompetitorEditor
                  value={competitors}
                  onChange={setCompetitors}
                  idPrefix="settings-competitor"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={handleSaveProject} disabled={savingProject}>
                {savingProject && <Loader2 className="animate-spin" />}
                保存项目设置
              </Button>
              <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 />
                删除项目
              </Button>
            </div>
          </>
        )}
      </SectionCard>

      <SectionCard
        icon={Database}
        title="本地数据"
        description="项目、提示词、批次、回答和来源都存在浏览器 IndexedDB。导出备份后再清理。"
      >
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleExportAll}>
            <Download />
            导出全部 JSON
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload />
            导入 JSON
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(event) => handleImport(event.target.files?.[0])}
          />
          <Button variant="outline" onClick={handleRestoreDemo}>
            <RefreshCw />
            恢复示例数据
          </Button>
          {projects?.some((item) => item.isDemo) && (
            <Button variant="ghost" onClick={handleDeleteDemo}>
              <Trash2 />
              删除示例数据
            </Button>
          )}
          <Button variant="destructive" onClick={handleClear}>
            <Trash2 />
            清除所有本地数据
          </Button>
        </div>
        <p className="text-[11px] leading-5 text-muted-foreground">
          导出的 JSON 包含完整回答和来源，可能含第三方内容。API Key 永远不会被导出。
        </p>
      </SectionCard>

      <SectionCard icon={Info} title="关于 GEO Probe" description={`v${APP_VERSION} · MIT License`}>
        <div className="grid gap-3 sm:grid-cols-2">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between rounded-lg border p-3 text-sm hover:bg-muted/40"
          >
            <span className="inline-flex items-center gap-2">
              <Code2 className="size-4" />
              GitHub 仓库
            </span>
            <ExternalLink className="size-3.5 text-muted-foreground" />
          </a>
          <a
            href={DEMO_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between rounded-lg border p-3 text-sm hover:bg-muted/40"
          >
            <span className="inline-flex items-center gap-2">
              <ExternalLink className="size-4" />
              在线演示
            </span>
            <ExternalLink className="size-3.5 text-muted-foreground" />
          </a>
        </div>

        <Separator />

        <div className="space-y-2 text-xs leading-6 text-muted-foreground">
          <p className="font-medium text-foreground">隐私</p>
          <p>{PRIVACY_TEXT}</p>
          <p className="font-medium text-foreground">口径与免责声明</p>
          <p>{DISCLAIMER}</p>
          <p>
            由{" "}
            <a href={COMPANY_URL} target="_blank" rel="noreferrer" className="text-primary hover:underline">
              深圳市元构场智能科技有限公司
            </a>{" "}
            开源。
          </p>
        </div>

      </SectionCard>

      <DeleteProjectDialog
        project={project ?? null}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </div>
  );
}
