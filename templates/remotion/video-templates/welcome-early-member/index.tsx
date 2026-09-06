import type { WelcomeEarlyMemberProps } from "./schema";
import { welcomeEarlyMemberSchema } from "./schema";
import {
  WelcomeEarlyMember,
  welcomeEarlyMemberDuration,
} from "./welcome-early-member";

export const meta = {
  durationInFrames: welcomeEarlyMemberDuration,
  fps: 30,
  height: 1080,
  width: 1920,
};

export const schema = welcomeEarlyMemberSchema;

export const defaultProps: WelcomeEarlyMemberProps = __TEMPLATE_PROPS__;

export default function Video(props: Partial<WelcomeEarlyMemberProps>) {
  return <WelcomeEarlyMember {...defaultProps} {...props} />;
}
