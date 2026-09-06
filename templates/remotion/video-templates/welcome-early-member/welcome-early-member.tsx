// A copy of the landing's composition, synced by hand until it is published to
// the remocn registry. The original: remocn-studio-landing/remotion/welcome-early-member/index.tsx
// (its components under components/remocn/, the glyph in components/landing/logo.tsx).

import { loadFont as loadSans } from "@remotion/google-fonts/DMSans";
import { loadFont as loadMono } from "@remotion/google-fonts/GeistMono";
import { loadFont as loadHeading } from "@remotion/google-fonts/Manrope";
import type { ReactNode } from "react";
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from "remotion";
import { GLYPH } from "./logo";
import { Backdrop } from "./components/remocn/backdrop";
import { Confetti } from "./components/remocn/confetti";
import { NumberWheel } from "./components/remocn/number-wheel";
import { ShaderNeuroNoise } from "./components/remocn/shader-neuro-noise";
import { SoftBlurIn } from "./components/remocn/soft-blur-in";
import {
  daysWaited,
  firstWordOf,
  formatJoined,
  type WelcomeEarlyMemberProps,
} from "./schema";

// The site's own fonts, so the video and the page around it are the same
// typeface rather than two that nearly match. Only the weights and the subset
// this composition actually sets — the default pulls every variant, which is
// dozens of requests the renderer waits on.
const { fontFamily: heading } = loadHeading("normal", {
  weights: ["600"],
  subsets: ["latin"],
});
const { fontFamily: sans } = loadSans("normal", {
  weights: ["400"],
  subsets: ["latin"],
});
const { fontFamily: mono } = loadMono("normal", {
  weights: ["400"],
  subsets: ["latin"],
});

/**
 * The palette is `/welcome`'s, down to the shader: `NeuroBackground` on the
 * site runs the same three colours, so the video reads as part of the page.
 */
const colors = {
  background: "#0c0e14",
  foreground: "#fafdfd",
  muted: "#a2b0b3",
  accent: "#e879f9",
  shaderFront: "#f0abfc",
  shaderMid: "#86198f",
};

export const welcomeEarlyMemberDuration = 300;

/** Enter and leave on opacity, so scenes hand over instead of cutting. */
function Fade({
  durationInFrames,
  enter = 12,
  exit = 12,
  children,
}: {
  durationInFrames: number;
  enter?: number;
  exit?: number;
  children: ReactNode;
}) {
  const frame = useCurrentFrame();
  const clamp = {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  } as const;
  // Two ramps rather than one four-stop range: the last scene ends on the last
  // frame and asks for no exit, which would collapse that range's final stops.
  const opacity =
    interpolate(frame, [0, enter], [0, 1], clamp) *
    (exit > 0
      ? interpolate(
          frame,
          [durationInFrames - exit, durationInFrames],
          [1, 0],
          clamp,
        )
      : 1);
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
}

function EarlyMemberScene({
  memberNumber,
  joinedAt,
  launchedAt,
}: Pick<WelcomeEarlyMemberProps, "memberNumber" | "joinedAt" | "launchedAt">) {
  const waited = daysWaited(joinedAt, launchedAt);

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 28,
      }}
    >
      <span
        style={{
          fontFamily: mono,
          fontSize: 28,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: colors.accent,
        }}
      >
        Early member
      </span>
      {/* The wheel centres itself in whatever box it is given, so it gets one
          of a fixed height rather than a place in the column. */}
      <div style={{ position: "relative", width: "100%", height: 200 }}>
        <NumberWheel
          from={0}
          to={memberNumber}
          prefix="#"
          fontSize={168}
          color={colors.foreground}
          speed={1.6}
        />
      </div>
      <span
        style={{
          fontFamily: sans,
          fontSize: 30,
          color: colors.muted,
        }}
      >
        joined {formatJoined(joinedAt)}
        {waited > 0 && ` · ${waited} days before launch`}
      </span>
    </AbsoluteFill>
  );
}

/** The wordmark, drawn from the site's own glyph rather than a second copy. */
function Outro() {
  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          fontFamily: heading,
          fontSize: 64,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          color: colors.foreground,
        }}
      >
        <svg
          aria-hidden="true"
          fill="none"
          style={{ height: "1em", width: "auto" }}
          viewBox="0 0 124.06 134.26"
        >
          <path d={GLYPH} fill="currentColor" />
        </svg>
        <span style={{ marginLeft: "0.04em" }}>emocn Studio</span>
      </div>
      <span
        style={{
          fontFamily: mono,
          fontSize: 26,
          letterSpacing: "0.08em",
          color: colors.muted,
        }}
      >
        remocn.studio
      </span>
    </AbsoluteFill>
  );
}

export function WelcomeEarlyMember({
  name,
  memberNumber,
  joinedAt,
  launchedAt,
}: WelcomeEarlyMemberProps) {
  return (
    <Backdrop
      fill={
        <ShaderNeuroNoise
          speed={0.5}
          colorFront={colors.shaderFront}
          colorMid={colors.shaderMid}
          colorBack={colors.background}
          brightness={0.08}
          contrast={0.3}
        />
      }
      padding={0}
      radius={0}
      shadow=""
    >
      {/* The same wash the page puts over its own shader, plus a pool of dark
          in the middle: the filaments are bright enough to read as noise
          through type, and every scene puts its type in the same place. */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(to bottom, ${colors.background}b3, ${colors.background}66 45%, ${colors.background})`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(60% 46% at 50% 50%, ${colors.background}d9, transparent)`,
        }}
      />

      <Sequence from={15} durationInFrames={115}>
        <Fade durationInFrames={115}>
          <AbsoluteFill style={{ fontFamily: heading }}>
            <SoftBlurIn
              text={`Thank you, ${firstWordOf(name)}`}
              blur={14}
              fontSize={104}
              fontWeight={600}
              color={colors.foreground}
            />
          </AbsoluteFill>
        </Fade>
      </Sequence>

      <Sequence from={125} durationInFrames={130}>
        <Fade durationInFrames={130}>
          <EarlyMemberScene
            memberNumber={memberNumber}
            joinedAt={joinedAt}
            launchedAt={launchedAt}
          />
        </Fade>
      </Sequence>

      {/* Fires on the frame the wheel settles on: at speed 1.6 the count
          finishes 65 frames into a 130-frame scene that starts at 125. */}
      <Sequence from={190} durationInFrames={110}>
        <Confetti
          startFrame={0}
          lifetime={90}
          particleCount={90}
          size={11}
          // Launched from under the frame rather than from the number: a
          // radial burst spends its first few frames as a clump, and a clump
          // on the centre is exactly the thing nobody should have to read
          // through.
          originY={0.95}
          power={24}
          colors={[
            colors.accent,
            colors.shaderFront,
            colors.shaderMid,
            colors.foreground,
          ]}
          seed={7}
        />
      </Sequence>

      <Sequence from={245} durationInFrames={55}>
        <Fade durationInFrames={55} exit={0}>
          <Outro />
        </Fade>
      </Sequence>
    </Backdrop>
  );
}
