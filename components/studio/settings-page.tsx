"use client";

import {
  ArrowLeftIcon,
  BotIcon,
  CheckIcon,
  CircleArrowUpIcon,
  CircleUserRoundIcon,
  CopyIcon,
  ImagesIcon,
  LightbulbIcon,
  MailIcon,
  MessageSquareIcon,
  RotateCwIcon,
  SlidersHorizontalIcon,
  SunMoonIcon,
} from "lucide-react";
import type { MouseEvent } from "react";
import { useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { useCopyCommand } from "@/hooks/use-copy-command";
import { useScrolledIntoView } from "@/hooks/use-scrolled-into-view";
import {
  isSettingsSection,
  type SettingsSection,
} from "@/hooks/use-settings-view";
import { useStockKey } from "@/hooks/use-stock-key";
import {
  isThemeChoice,
  type ThemeChoice,
  useThemeChoice,
} from "@/hooks/use-theme-choice";
import type { ShellMood } from "@/lib/studio/mood";
import { modKeyLabel } from "@/lib/studio/platform";
import { cn } from "@/lib/utils";
import type { AppEnvironment, EnvironmentCheck } from "@/shared/ipc";
import {
  AGENT_PROVIDERS,
  type AgentProvider,
  PROVIDER_INFO,
} from "@/shared/providers";
import { AccountSection } from "./account-section";
import { CHECK_ICONS, CHECK_TONES } from "./environment-checklist";
import { ProviderIcon } from "./provider-icon";
import { ProviderSteps } from "./provider-steps";
import { useStudio } from "./studio-provider";
import { MoodField } from "./titlebar";
import { UpdatesBody } from "./update-status";

type SectionId = SettingsSection;

const SECTIONS: readonly {
  description: string;
  icon: typeof SunMoonIcon;
  id: SectionId;
  label: string;
}[] = [
  {
    description: "Your Remocn account, plan and devices",
    icon: CircleUserRoundIcon,
    id: "account",
    label: "Account",
  },
  {
    description: "How the studio looks",
    icon: SunMoonIcon,
    id: "appearance",
    label: "Appearance",
  },
  {
    description: "What the studio does on its own",
    icon: SlidersHorizontalIcon,
    id: "behavior",
    label: "Behavior",
  },
  {
    description: "Searching Pexels from the Assets pane",
    icon: ImagesIcon,
    id: "stock",
    label: "Stock media",
  },
  {
    description: "Keep the studio current",
    icon: CircleArrowUpIcon,
    id: "updates",
    label: "Updates",
  },
  {
    description: "Who answers when a session speaks",
    icon: BotIcon,
    id: "accounts",
    label: "AI Accounts",
  },
  {
    description: "Tell us what broke, or what is missing",
    icon: MessageSquareIcon,
    id: "feedback",
    label: "Feedback",
  },
];

// Settings takes the window: a rail on the left, one readable column on the
// right, and nothing floating. The shell stays mounted underneath — inert, so
// keys and clicks cannot reach it — which is what keeps the preview's iframe
// and a running turn exactly where they were when the page closes. There is
// no entrance animation on purpose: this should feel like switching a tab,
// not opening a window.
export function SettingsPage() {
  const { settingsView } = useStudio();
  const { section, setSection } = settingsView;

  const onPickSection = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const picked = event.currentTarget.value;
      if (isSettingsSection(picked)) {
        setSection(picked);
      }
    },
    [setSection]
  );

  if (!settingsView.isOpen) {
    return null;
  }

  const active = SECTIONS.find((entry) => entry.id === section) ?? SECTIONS[0];

  return (
    <section
      aria-label="Settings"
      className="fixed inset-0 z-40 flex bg-background text-foreground"
    >
      <SectionRail
        active={section}
        onBack={settingsView.close}
        onPick={onPickSection}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <div
          className="h-(--titlebar-block-inset) shrink-0"
          data-tauri-drag-region
        />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-10 pt-2 pb-12">
            <header className="flex flex-col gap-1">
              <h2 className="font-heading font-medium text-xl tracking-tight">
                {active.label}
              </h2>
              <p className="text-muted-foreground text-sm">
                {active.description}
              </p>
            </header>

            {section === "account" ? <AccountSection /> : null}
            {section === "appearance" ? <AppearanceSection /> : null}
            {section === "behavior" ? <BehaviorSection /> : null}
            {section === "stock" ? <StockSection /> : null}
            {section === "updates" ? <UpdatesSection /> : null}
            {section === "accounts" ? <AccountsSection /> : null}
            {section === "feedback" ? <FeedbackSection /> : null}
          </div>
        </div>
      </div>
    </section>
  );
}

// The rail follows the pane's menus: no weight change between states, a
// muted background for the open section, icons leading. The Updates row
// carries a dot while a release is waiting, so the dialog never hides it.
function SectionRail({
  active,
  onBack,
  onPick,
}: {
  active: SectionId;
  onBack: () => void;
  onPick: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const { updates } = useStudio();

  return (
    <aside className="flex w-56 shrink-0 flex-col bg-sidebar p-3 pt-(--titlebar-block-inset)">
      {/* The arrow and the word are one control: the whole row goes back,
          and the word is what the row is named by. */}
      <div className="mb-3" data-tauri-drag-region>
        <Button
          aria-label="Back"
          className="text-foreground"
          onClick={onBack}
          size="sm"
          variant="ghost"
        >
          <ArrowLeftIcon
            className="text-muted-foreground"
            data-icon="inline-start"
          />
          <span className="font-heading font-medium text-sm">Settings</span>
        </Button>
        <h1 className="sr-only">Settings</h1>
      </div>

      <nav aria-label="Settings sections" className="flex flex-col gap-0.5">
        {SECTIONS.map((entry) => (
          <button
            aria-current={active === entry.id ? "true" : undefined}
            className={cn(
              "flex h-8 items-center gap-2 rounded-md px-2 text-left text-sm outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring/50 active:bg-accent",
              active === entry.id
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            )}
            key={entry.id}
            onClick={onPick}
            type="button"
            value={entry.id}
          >
            <entry.icon className="size-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{entry.label}</span>
            {entry.id === "updates" && updates.release !== null ? (
              <span
                aria-label="An update is available"
                className="size-1.5 shrink-0 rounded-full bg-primary"
                role="status"
              />
            ) : null}
          </button>
        ))}
      </nav>

      <p className="mt-auto flex items-center gap-1.5 whitespace-nowrap px-2 text-muted-foreground text-xs">
        <KbdGroup>
          <Kbd>{modKeyLabel()}</Kbd>
          <Kbd>,</Kbd>
        </KbdGroup>
        opens Settings
      </p>
    </aside>
  );
}

const THEME_TILES: readonly {
  caption: string;
  id: ThemeChoice;
  label: string;
  swatch: string;
  bar: string;
  chip: string;
}[] = [
  {
    bar: "bg-white/25",
    caption: "The studio’s native palette",
    chip: "bg-white/10",
    id: "dark",
    label: "Dark",
    swatch: "bg-[#141318]",
  },
  {
    bar: "bg-black/40",
    caption: "Bright surfaces, dark text",
    chip: "bg-black/10",
    id: "light",
    label: "Light",
    swatch: "bg-white",
  },
  {
    bar: "bg-white/25",
    caption: "Follows macOS",
    chip: "bg-black/25",
    id: "system",
    label: "System",
    swatch: "bg-linear-to-br from-[#141318] from-50% to-white to-50%",
  },
];

function AppearanceSection() {
  return (
    <div className="flex flex-col gap-8">
      <ThemeGroup />
      <TitlebarGroup />
    </div>
  );
}

function ThemeGroup() {
  const { choice, select } = useThemeChoice();

  const onPickTheme = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const picked = event.currentTarget.value;
      if (isThemeChoice(picked)) {
        select(picked);
      }
    },
    [select]
  );

  return (
    <section aria-label="Theme" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm">Theme</h3>
        <p className="text-muted-foreground text-xs leading-snug">
          {THEME_TILES.find((tile) => tile.id === choice)?.caption ??
            "Dark is the default until a choice is made"}
        </p>
      </div>

      <div className="flex gap-3">
        {THEME_TILES.map((tile) => (
          <button
            aria-pressed={choice === tile.id}
            className="group flex min-w-0 flex-1 flex-col items-stretch gap-2 rounded-md outline-none active:translate-y-px"
            key={tile.id}
            onClick={onPickTheme}
            type="button"
            value={tile.id}
          >
            <span
              className={cn(
                "flex h-16 flex-col justify-between rounded-md p-2 ring-1 ring-foreground/10 ring-inset transition-shadow group-focus-visible:ring-2 group-focus-visible:ring-ring",
                tile.swatch,
                choice === tile.id && "ring-2 ring-primary"
              )}
            >
              <span className={cn("h-1.5 w-1/2 rounded-full", tile.bar)} />
              <span
                className={cn("h-4 w-2/3 self-end rounded-sm", tile.chip)}
              />
            </span>
            <span
              className={cn(
                "text-xs",
                choice === tile.id ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {tile.label}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

const SAMPLE_MOOD: ShellMood = { isBusy: false, tone: "idle" };

// The band under the traffic lights, with the shader the shell breathes
// through: on by default, and both halves are a person's to turn off. The
// sample is the same field the shell draws, so the switches show their
// effect where the person is looking rather than behind the page.
function TitlebarGroup() {
  const { preferences } = useStudio();

  return (
    <section aria-label="Title bar" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm">Title bar</h3>
        <p className="text-muted-foreground text-xs leading-snug">
          The band at the top of the window carries a shader that shifts with
          what the studio is doing: calm while idle, faster while a turn runs,
          another hue while something waits on you or has failed.
        </p>
      </div>

      <div
        aria-hidden="true"
        className="relative h-16 overflow-hidden rounded-md bg-sidebar ring-1 ring-foreground/10 ring-inset"
      >
        {preferences.titlebarShader ? (
          <MoodField
            isBooting={false}
            isStill={!preferences.titlebarMotion}
            mood={SAMPLE_MOOD}
          />
        ) : null}
      </div>

      <div className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-6">
          <div className="flex min-w-0 flex-col gap-1">
            <Label className="text-sm" htmlFor="settings-titlebar-shader">
              Show the shader
            </Label>
            <p className="text-muted-foreground text-xs leading-snug">
              Off leaves the band plain, in the sidebar&rsquo;s own colour
            </p>
          </div>
          <Switch
            checked={preferences.titlebarShader}
            className="mt-0.5"
            id="settings-titlebar-shader"
            onCheckedChange={preferences.setTitlebarShader}
          />
        </div>

        <div className="flex items-start justify-between gap-6">
          <div className="flex min-w-0 flex-col gap-1">
            <Label className="text-sm" htmlFor="settings-titlebar-motion">
              Animate it
            </Label>
            <p className="text-muted-foreground text-xs leading-snug">
              Off holds one frame of the field; the hue still follows the mood.
              Also off whenever macOS asks to reduce motion.
            </p>
          </div>
          <Switch
            checked={preferences.titlebarMotion}
            className="mt-0.5"
            disabled={!preferences.titlebarShader}
            id="settings-titlebar-motion"
            onCheckedChange={preferences.setTitlebarMotion}
          />
        </div>
      </div>
    </section>
  );
}

function BehaviorSection() {
  const { preferences, tours, updates } = useStudio();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-6">
        <div className="flex min-w-0 flex-col gap-1">
          <Label className="text-sm" htmlFor="settings-asset-offers">
            Library suggestions
          </Label>
          <p className="text-muted-foreground text-xs leading-snug">
            When a turn ends, offer to save the pictures and clips it carried
            into the asset library
          </p>
        </div>
        <Switch
          checked={preferences.assetOffers}
          className="mt-0.5"
          id="settings-asset-offers"
          onCheckedChange={preferences.setAssetOffers}
        />
      </div>

      {/* Replaying forgets every "Got it". Nothing appears while this page
          is open — a tip never competes with something already on screen — so
          the first one arrives after it is closed. */}
      <div className="flex items-start justify-between gap-6">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-sm">Tips</span>
          <p className="text-muted-foreground text-xs leading-snug">
            A short pointer the first time a part of the studio becomes usable,
            one at a time, never twice
          </p>
        </div>
        <Button
          disabled={!tours.hasSeenAny}
          onClick={tours.replay}
          size="sm"
          variant="outline"
        >
          <LightbulbIcon data-icon="inline-start" />
          Replay tips
        </Button>
      </div>

      <CrashReportsRow
        environment={updates.environment}
        onChange={preferences.setCrashReports}
        value={preferences.crashReports}
      />
    </div>
  );
}

// Off until it is switched on, and the wording has to earn the switch rather
// than reassure past it: what is sent, what is never sent, and — where the
// studio can already say so — that this particular build would send nothing
// whatever the switch says.
function CrashReportsRow({
  environment,
  onChange,
  value,
}: {
  environment: AppEnvironment | null;
  onChange: (enabled: boolean) => void;
  value: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-6">
        <div className="flex min-w-0 flex-col gap-1">
          <Label className="text-sm" htmlFor="settings-crash-reports">
            Send crash reports
          </Label>
          <p className="text-muted-foreground text-xs leading-snug">
            When the studio, its agent process or its preview crashes, send the
            error and where in the code it happened. Off unless you turn it on.
          </p>
        </div>
        <Switch
          checked={value}
          className="mt-0.5"
          id="settings-crash-reports"
          onCheckedChange={onChange}
        />
      </div>

      <p className="text-muted-foreground text-xs leading-snug">
        Your prompts, your conversations with the agent and the contents of your
        project files are never included, and paths are stripped of your home
        folder before anything is sent.
      </p>

      {environment === "development" ? (
        <p className="text-muted-foreground text-xs leading-snug">
          This is a development build — it reports nothing either way.
        </p>
      ) : null}
    </div>
  );
}

function FeedbackSection() {
  const { feedback } = useStudio();

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-xs leading-snug">
        Feedback is an email: the button opens your mail client with the
        studio&rsquo;s version, your macOS version and the session&rsquo;s agent
        already filled in. You write the rest and send it yourself &mdash;
        nothing leaves the app on its own.
      </p>
      <p className="text-muted-foreground text-xs leading-snug">
        A screenshot says more than a paragraph &mdash; attach one to the email
        by hand before sending.
      </p>
      <div>
        <Button onClick={feedback.send} size="sm" variant="outline">
          <MailIcon data-icon="inline-start" />
          Email feedback
        </Button>
      </div>
      {feedback.error === null ? null : (
        <p className="break-words text-destructive text-xs">{feedback.error}</p>
      )}
    </div>
  );
}

function UpdatesSection() {
  const { updates } = useStudio();

  return (
    <div className="flex flex-col gap-3">
      <UpdatesBody updates={updates} />
    </div>
  );
}

function AccountsSection() {
  const { accounts, settingsView } = useStudio();

  return (
    <div className="flex flex-col gap-1">
      <div className="mb-1 flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs">
          Each provider is asked with its own probe — a session can only start
          on one that is signed in
        </p>
        <Button
          disabled={accounts.isChecking}
          onClick={accounts.recheck}
          size="xs"
          variant="ghost"
        >
          {accounts.isChecking ? (
            <Spinner className="size-3" data-icon="inline-start" />
          ) : (
            <RotateCwIcon data-icon="inline-start" />
          )}
          Recheck
        </Button>
      </div>

      {AGENT_PROVIDERS.map((provider) => (
        <AccountRow
          isChecking={accounts.isChecking}
          isFocused={settingsView.provider === provider}
          key={provider}
          provider={provider}
          row={accounts.rows[provider]}
        />
      ))}
    </div>
  );
}

function AccountRow({
  isChecking,
  isFocused,
  provider,
  row,
}: {
  isChecking: boolean;
  isFocused: boolean;
  provider: AgentProvider;
  row: EnvironmentCheck | undefined;
}) {
  const info = PROVIDER_INFO[provider];
  const StateIcon = row === undefined ? null : CHECK_ICONS[row.state];
  const anchor = useScrolledIntoView<HTMLDivElement>(isFocused);

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-md py-2.5",
        isFocused && "-mx-2 bg-muted/50 px-2"
      )}
      data-provider={provider}
      ref={anchor}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
        <ProviderIcon className="size-4" provider={provider} />
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-1.5 text-sm">
          {info.name}
          {info.experimental ? (
            <Badge className="text-2xs" variant="outline">
              Experimental
            </Badge>
          ) : null}
        </span>

        <AccountStatus isChecking={isChecking} provider={provider} row={row} />
      </div>

      {StateIcon === null || row === undefined ? null : (
        <StateIcon
          aria-hidden="true"
          className={cn("mt-1 size-3.5 shrink-0", CHECK_TONES[row.state])}
        />
      )}
    </div>
  );
}

// A provider with no row yet is presented plainly: "unknown" must never read
// as "signed out".
function AccountStatus({
  isChecking,
  provider,
  row,
}: {
  isChecking: boolean;
  provider: AgentProvider;
  row: EnvironmentCheck | undefined;
}) {
  const { copied, onCopy } = useCopyCommand();

  if (row === undefined) {
    return (
      <span className="text-muted-foreground text-xs">
        {isChecking ? "Checking…" : "Not checked yet"}
      </span>
    );
  }

  return (
    <>
      <span className="text-muted-foreground text-xs leading-snug">
        {row.title}
      </span>

      {row.detail === null ? null : (
        <span className="whitespace-pre-wrap break-words text-muted-foreground text-xs leading-snug">
          {row.detail}
        </span>
      )}

      {row.fix?.type === "provider" ? (
        <ProviderSteps provider={provider} row={row} />
      ) : null}

      {row.fix?.type === "command" ? (
        <span className="mt-1 flex items-center gap-2">
          <code className="select-text rounded-sm bg-muted px-1.5 py-0.5 font-mono text-xs">
            {row.fix.command}
          </code>
          <Button
            onClick={onCopy}
            size="xs"
            value={row.fix.command}
            variant="ghost"
          >
            {copied === row.fix.command ? (
              <CheckIcon data-icon="inline-start" />
            ) : (
              <CopyIcon data-icon="inline-start" />
            )}
            {copied === row.fix.command ? "Copied" : "Copy"}
          </Button>
        </span>
      ) : null}
    </>
  );
}

function StockSection() {
  const stockKey = useStockKey();
  const canSave = stockKey.value.trim().length > 0;

  return (
    <section aria-label="Pexels" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <Label className="text-sm" htmlFor="settings-pexels-key">
          Pexels API key
        </Label>
        <p className="text-muted-foreground text-xs leading-snug">
          The key is free at pexels.com/api. It is kept in the studio’s own data
          folder on this machine and never leaves it except to talk to Pexels.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Input
          className="flex-1"
          id="settings-pexels-key"
          onChange={stockKey.onChange}
          placeholder={
            stockKey.isConfigured === true ? "A key is saved" : "Paste your key"
          }
          type="password"
          value={stockKey.value}
        />
        <Button
          disabled={!canSave}
          onClick={stockKey.onSave}
          size="sm"
          variant="outline"
        >
          Save
        </Button>
        {stockKey.isConfigured === true ? (
          <Button onClick={stockKey.onForget} size="sm" variant="ghost">
            Remove
          </Button>
        ) : null}
      </div>

      {stockKey.error === null ? null : (
        <p className="break-words text-destructive text-xs">{stockKey.error}</p>
      )}
    </section>
  );
}
