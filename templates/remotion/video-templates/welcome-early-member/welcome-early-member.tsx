// Synced from remocn-studio-landing/remotion/welcome-early-member/index.tsx.
// Keep the composition and its remocn components in sync with the landing.

import { loadFont as loadHeading } from "@remotion/google-fonts/Manrope";
import type { CSSProperties, ReactNode } from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { GLYPH } from "./logo";
import { Backdrop } from "./components/remocn/backdrop";
import { KineticCenterBuild } from "./components/remocn/kinetic-center-build";
import { NumberWheel } from "./components/remocn/number-wheel";
import { PerCharacterRise } from "./components/remocn/per-character-rise";
import { StaggeredFadeUp } from "./components/remocn/staggered-fade-up";
import {
  firstWordOf,
  formatJoined,
  type WelcomeEarlyMemberProps,
} from "./schema";

const { fontFamily, waitUntilDone } = loadHeading("normal", {
  weights: ["400", "500", "600", "700", "800"],
  subsets: ["latin", "cyrillic"],
});

const headingReady = waitUntilDone();

const colors = {
  paper: "#f2efe8",
  ink: "#262329",
  muted: "#79737c",
  accent: "#893c91",
  lilac: "#e2cde7",
};
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = { ...clamp, easing: Easing.bezier(0.22, 1, 0.36, 1) };

export const welcomeEarlyMemberDuration = 570;

function Wordmark() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        fontSize: 30,
        fontWeight: 600,
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
  );
}

function Scene({
  children,
  duration,
  last = false,
}: {
  children: ReactNode;
  duration: number;
  last?: boolean;
}) {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        opacity: last
          ? 1
          : interpolate(frame, [duration - 12, duration], [1, 0], clamp),
        translate: `0 ${last ? 0 : interpolate(frame, [duration - 12, duration], [0, -24], ease)}px`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
}

function TextArea({
  children,
  top,
  height,
  left = 100,
  right = 100,
}: {
  children: ReactNode;
  top: number;
  height: number;
  left?: number;
  right?: number;
}) {
  return (
    <div style={{ position: "absolute", top, height, left, right }}>
      {children}
    </div>
  );
}

function Intro({ name }: { name: string }) {
  const frame = useCurrentFrame();
  const firstName = firstWordOf(name);
  const nameSize = Math.min(
    210,
    1400 / Math.max(5, Array.from(firstName).length * 0.72),
  );
  return (
    <Scene duration={125}>
      <TextArea top={290} height={110}>
        <KineticCenterBuild
          fontFamily={fontFamily}
          fontLoadPromise={headingReady}
          text="This one's for you."
          fontSize={76}
          fontWeight={500}
          color={colors.ink}
        />
      </TextArea>
      <Sequence from={24} layout="none">
        <TextArea top={420} height={270}>
          <PerCharacterRise
            text={`${firstName}.`}
            distance={80}
            fontSize={nameSize}
            fontWeight={700}
            color={colors.accent}
          />
        </TextArea>
      </Sequence>
      <div
        style={{
          position: "absolute",
          left: 760,
          right: 760,
          top: 735,
          height: 4,
          background: colors.accent,
          transformOrigin: "left",
          scale: `${interpolate(frame, [48, 76], [0, 1], ease)} 1`,
        }}
      />
      <TextArea top={805} height={55}>
        <Sequence from={48} layout="none">
          <StaggeredFadeUp
            text="A little thank-you, made just for you."
            fontSize={34}
            fontWeight={400}
            color={colors.muted}
          />
        </Sequence>
      </TextArea>
    </Scene>
  );
}

function Belief() {
  const frame = useCurrentFrame();
  return (
    <Scene duration={135}>
      <TextArea top={275} height={180}>
        <KineticCenterBuild
          fontFamily={fontFamily}
          fontLoadPromise={headingReady}
          text="You believed in us."
          fontSize={126}
          fontWeight={700}
          color={colors.ink}
          entryOffset={150}
        />
      </TextArea>
      <Sequence from={28} layout="none">
        <TextArea top={470} height={170}>
          <PerCharacterRise
            text="Before the beginning."
            fontSize={112}
            fontWeight={600}
            color={colors.accent}
            distance={64}
          />
        </TextArea>
      </Sequence>
      <div
        style={{
          position: "absolute",
          left: 500,
          right: 500,
          top: 750,
          height: 2,
          background: "#d5cfd5",
        }}
      >
        <div
          style={{
            height: "100%",
            background: colors.accent,
            transformOrigin: "left",
            scale: `${interpolate(frame, [45, 92], [0, 1], ease)} 1`,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: -9,
            left: 0,
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: colors.accent,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: -9,
            right: 0,
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: colors.accent,
            scale: interpolate(frame, [85, 96], [0, 1], ease),
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 32,
            left: 0,
            fontSize: 28,
            color: colors.muted,
          }}
        >
          An idea
        </div>
        <div
          style={{
            position: "absolute",
            top: 32,
            right: 0,
            fontSize: 28,
            color: colors.muted,
          }}
        >
          A new beginning
        </div>
      </div>
    </Scene>
  );
}

function Member({
  memberNumber,
  joinedAt,
}: Pick<WelcomeEarlyMemberProps, "memberNumber" | "joinedAt">) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const arrive = spring({
    frame,
    fps,
    config: { damping: 22, stiffness: 100 },
  });
  return (
    <Scene duration={145}>
      <div
        style={{
          position: "absolute",
          left: 145,
          top: 235,
          width: 650,
          height: 610,
          background: colors.lilac,
          border: "2px solid #d6bddc",
          borderRadius: 24,
          rotate: `${interpolate(arrive, [0, 1], [-9, -3])}deg`,
          translate: `0 ${interpolate(arrive, [0, 1], [150, 0])}px`,
          opacity: interpolate(frame, [0, 12], [0, 1], clamp),
          boxShadow: "0 24px 45px #26232912",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 52,
            left: 50,
            fontSize: 34,
            fontWeight: 500,
          }}
        >
          Here from the start.
        </div>
        <div
          style={{
            position: "absolute",
            top: 154,
            left: 30,
            right: 30,
            height: 235,
          }}
        >
          <NumberWheel
            from={0}
            to={memberNumber}
            prefix="#"
            fontSize={Math.min(176, 740 / (String(memberNumber).length + 1))}
            speed={1.7}
            color={colors.ink}
          />
        </div>
        <div
          style={{
            position: "absolute",
            top: 440,
            left: 0,
            right: 0,
            borderTop: "2px dashed #b59cbd",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 48,
            left: 50,
            fontSize: 28,
            color: "#65516c",
          }}
        >
          Early member · {formatJoined(joinedAt)}
        </div>
      </div>
      <div style={{ position: "absolute", top: 305, left: 920, right: 130 }}>
        <div style={{ fontSize: 90, fontWeight: 700, lineHeight: 1.15 }}>
          Your support
          <br />
          means a lot.
        </div>
        <div style={{ position: "relative", height: 75, marginTop: 48 }}>
          <Sequence from={26} layout="none">
            <StaggeredFadeUp
              align="left"
              text="You gave us a reason"
              fontSize={43}
              fontWeight={400}
              color={colors.muted}
            />
          </Sequence>
        </div>
        <div style={{ position: "relative", height: 65 }}>
          <Sequence from={42} layout="none">
            <StaggeredFadeUp
              align="left"
              text="to keep building."
              fontSize={43}
              fontWeight={400}
              color={colors.muted}
            />
          </Sequence>
        </div>
      </div>
    </Scene>
  );
}

function Thanks() {
  const frame = useCurrentFrame();
  return (
    <Scene duration={165} last>
      <TextArea top={260} height={230}>
        <PerCharacterRise
          text="Thank you."
          fontSize={208}
          fontWeight={700}
          color={colors.accent}
          distance={90}
        />
      </TextArea>
      <Sequence from={22} layout="none">
        <TextArea top={535} height={80}>
          <StaggeredFadeUp
            text="For your trust. For being here early."
            fontSize={48}
            fontWeight={400}
            color={colors.ink}
            staggerDelay={5}
          />
        </TextArea>
      </Sequence>
      <div
        style={{
          position: "absolute",
          left: 400,
          right: 400,
          top: 715,
          textAlign: "center",
          opacity: interpolate(frame, [70, 90], [0, 1], ease),
          translate: `0 ${interpolate(frame, [70, 90], [20, 0], ease)}px`,
        }}
      >
        <span
          style={{
            display: "inline-block",
            padding: "24px 42px",
            borderRadius: 60,
            background: colors.lilac,
            fontSize: 38,
            fontWeight: 500,
          }}
        >
          Now, let's make something great.
        </span>
      </div>
    </Scene>
  );
}

export function WelcomeEarlyMember(props: WelcomeEarlyMemberProps) {
  const frame = useCurrentFrame();
  return (
    <Backdrop
      fill={{ type: "color", value: colors.paper }}
      padding={0}
      radius={0}
      shadow=""
    >
      <AbsoluteFill
        style={
          {
            fontFamily,
            color: colors.ink,
            "--font-geist-sans": fontFamily,
          } as CSSProperties
        }
      >
        <div style={{ position: "absolute", top: 64, left: 80 }}>
          <Wordmark />
        </div>
        <div
          style={{
            position: "absolute",
            top: 68,
            right: 80,
            fontSize: 27,
            color: colors.muted,
          }}
        >
          A note to our early members
        </div>
        <Sequence durationInFrames={125}>
          <Intro name={props.name} />
        </Sequence>
        <Sequence from={125} durationInFrames={135}>
          <Belief />
        </Sequence>
        <Sequence from={260} durationInFrames={145}>
          <Member memberNumber={props.memberNumber} joinedAt={props.joinedAt} />
        </Sequence>
        <Sequence from={405} durationInFrames={165}>
          <Thanks />
        </Sequence>
        <div
          style={{
            position: "absolute",
            bottom: 60,
            left: 80,
            fontSize: 26,
            color: colors.muted,
          }}
        >
          Made with Remocn. Made possible by you.
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 72,
            right: 80,
            display: "flex",
            gap: 12,
          }}
        >
          {[0, 125, 260, 405].map((start, index, starts) => (
            <div
              key={start}
              style={{
                width: 44,
                height: 4,
                borderRadius: 2,
                background: colors.ink,
                opacity:
                  frame >= start &&
                  frame < (starts[index + 1] ?? welcomeEarlyMemberDuration)
                    ? 0.75
                    : 0.15,
              }}
            />
          ))}
        </div>
      </AbsoluteFill>
    </Backdrop>
  );
}
