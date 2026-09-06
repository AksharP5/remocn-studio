import { Schema } from "effect";

export const AccountDevice = Schema.Struct({
  id: Schema.String,
  lastSeenAt: Schema.String,
  name: Schema.String,
  platform: Schema.Literals(["macos", "windows", "linux"]),
});

export type AccountDevice = (typeof AccountDevice)["Type"];

export const AccountUser = Schema.Struct({
  email: Schema.String,
  emailVerified: Schema.Boolean,
  id: Schema.String,
  image: Schema.NullOr(Schema.String),
  name: Schema.String,
});

export type AccountUser = (typeof AccountUser)["Type"];

export const AccountMe = Schema.Struct({
  devices: Schema.Array(AccountDevice),
  session: Schema.Struct({ expiresAt: Schema.String, id: Schema.String }),
  user: AccountUser,
});

export type AccountMe = (typeof AccountMe)["Type"];

export const AccountStatus = Schema.Struct({
  origin: Schema.String,
  signedIn: Schema.Boolean,
});

export type AccountStatus = (typeof AccountStatus)["Type"];

export const SignInStart = Schema.Struct({
  expiresIn: Schema.Number,
  interval: Schema.Number,
  userCode: Schema.String,
  verificationUri: Schema.String,
});

export type SignInStart = (typeof SignInStart)["Type"];

export const DeviceLimit = Schema.Struct({
  devices: Schema.Array(AccountDevice),
  message: Schema.String,
  status: Schema.Literal("deviceLimit"),
});

export type DeviceLimit = (typeof DeviceLimit)["Type"];

export const SignInPoll = Schema.Union([
  Schema.Struct({ status: Schema.Literal("pending") }),
  Schema.Struct({ status: Schema.Literal("slowDown") }),
  Schema.Struct({ status: Schema.Literal("signedIn") }),
  Schema.Struct({ status: Schema.Literal("expired") }),
  Schema.Struct({ status: Schema.Literal("denied") }),
  DeviceLimit,
]);

export type SignInPoll = (typeof SignInPoll)["Type"];

export const ACCOUNT_FAILURE_KINDS = [
  "keychain",
  "offline",
  "server",
  "unauthorized",
] as const;

export const AccountFailure = Schema.Struct({
  kind: Schema.Literals(ACCOUNT_FAILURE_KINDS),
  message: Schema.String,
});

export type AccountFailure = (typeof AccountFailure)["Type"];

export const BillingPeriod = Schema.Literals(["month", "year"]);

export type BillingPeriod = (typeof BillingPeriod)["Type"];

// The launch prices, per month, mirrored from the landing's `lib/pricing.ts`:
// the menu quotes them and nothing else does.
export const PRO_PRICE = { monthly: 19, yearly: 15 } as const;

export const CheckoutStart = Schema.Struct({ checkoutUrl: Schema.String });

export type CheckoutStart = (typeof CheckoutStart)["Type"];

export const PortalLink = Schema.Struct({ url: Schema.String });

export type PortalLink = (typeof PortalLink)["Type"];

export const ACCOUNT_PAGE_PATH = "/account";
export const BILLING_PAGE_PATH = "/account/billing";

export const decodeAccountMe = Schema.decodeUnknownExit(AccountMe);
export const decodeAccountStatus = Schema.decodeUnknownExit(AccountStatus);
export const decodeSignInStart = Schema.decodeUnknownExit(SignInStart);
export const decodeSignInPoll = Schema.decodeUnknownExit(SignInPoll);
export const decodeAccountFailure = Schema.decodeUnknownExit(AccountFailure);
export const decodeCheckoutStart = Schema.decodeUnknownExit(CheckoutStart);
export const decodePortalLink = Schema.decodeUnknownExit(PortalLink);
