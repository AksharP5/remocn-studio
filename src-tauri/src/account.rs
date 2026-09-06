use std::process::Command;

use keyring::{Entry, Error as KeyringError};
use reqwest::{Client, RequestBuilder, StatusCode};
use serde::Serialize;
use serde_json::{json, Value};
use tauri::{AppHandle, State};
use tokio::sync::Mutex;

use crate::commands::macos_version;

const ORIGIN_ENV: &str = "REMOCN_STUDIO_ACCOUNT_URL";
const NO_ORIGIN: &str =
    "REMOCN_STUDIO_ACCOUNT_URL is not set, so the studio does not know where to sign in.";
const CLIENT_ID: &str = "remocn-studio";
const DEVICE_GRANT: &str = "urn:ietf:params:oauth:grant-type:device_code";
const KEYCHAIN_SERVICE: &str = "com.remocn.remocn-studio";
const KEYCHAIN_ACCOUNT: &str = "session-token";
const DEVICE_CODE_PATH: &str = "/api/auth/device/code";
const DEVICE_TOKEN_PATH: &str = "/api/auth/device/token";
const SIGN_OUT_PATH: &str = "/api/auth/sign-out";
const ME_PATH: &str = "/api/studio/me";
const ENTITLEMENT_PATH: &str = "/api/studio/entitlement";
const CHECKOUT_PATH: &str = "/api/studio/checkout";
const PORTAL_PATH: &str = "/api/studio/portal";
const NOT_SIGNED_IN: &str = "You are not signed in.";
const NO_SIGN_IN_PENDING: &str = "No sign-in is in progress.";

pub struct Account {
    client: Client,
    origin: Option<String>,
    pending: Mutex<Option<String>>,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum FailureKind {
    Keychain,
    Offline,
    Server,
    Unauthorized,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountFailure {
    pub kind: FailureKind,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountStatus {
    pub origin: String,
    pub signed_in: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SignInStart {
    pub expires_in: u64,
    pub interval: u64,
    pub user_code: String,
    pub verification_uri: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckoutStart {
    pub checkout_url: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PortalLink {
    pub url: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "status")]
pub enum SignInPoll {
    Denied,
    DeviceLimit { devices: Value, message: String },
    Expired,
    Pending,
    SignedIn,
    SlowDown,
}

impl Account {
    pub fn new(app: &AppHandle) -> Self {
        let version = app.package_info().version.to_string();
        let agent = format!(
            "Remocn Studio/{version} (macOS {}; {})",
            macos_version(),
            device_name()
        );
        let client = Client::builder()
            .user_agent(agent)
            .build()
            .unwrap_or_else(|_| Client::new());

        Self {
            client,
            origin: origin(),
            pending: Mutex::new(None),
        }
    }

    fn origin(&self) -> Result<&str, AccountFailure> {
        self.origin
            .as_deref()
            .ok_or_else(|| failure(FailureKind::Server, NO_ORIGIN))
    }

    fn url(&self, path: &str) -> Result<String, AccountFailure> {
        Ok(format!("{}{path}", self.origin()?))
    }

    async fn send(&self, request: RequestBuilder) -> Result<(StatusCode, Value), AccountFailure> {
        let response = request.send().await.map_err(|err| self.transport(err))?;
        let status = response.status();
        let body = response.json::<Value>().await.unwrap_or(Value::Null);
        Ok((status, body))
    }

    async fn signed(&self, request: RequestBuilder) -> Result<Value, AccountFailure> {
        let token =
            read_token()?.ok_or_else(|| failure(FailureKind::Unauthorized, NOT_SIGNED_IN))?;
        let (status, body) = self.send(request.bearer_auth(token)).await?;

        if status == StatusCode::UNAUTHORIZED {
            let _ = clear_token();
            return Err(failure(FailureKind::Unauthorized, said(&body, status)));
        }
        if !status.is_success() {
            return Err(failure(FailureKind::Server, said(&body, status)));
        }
        Ok(body)
    }

    fn transport(&self, err: reqwest::Error) -> AccountFailure {
        if err.is_connect() || err.is_timeout() || err.is_request() {
            failure(
                FailureKind::Offline,
                format!(
                    "The studio could not reach {}.",
                    self.origin.as_deref().unwrap_or("the account server")
                ),
            )
        } else {
            failure(FailureKind::Server, err.to_string())
        }
    }
}

#[tauri::command]
pub async fn account_status(account: State<'_, Account>) -> Result<AccountStatus, AccountFailure> {
    Ok(AccountStatus {
        origin: account.origin()?.to_string(),
        signed_in: read_token()?.is_some(),
    })
}

#[tauri::command]
pub async fn account_sign_in_start(
    account: State<'_, Account>,
) -> Result<SignInStart, AccountFailure> {
    let request = account
        .client
        .post(account.url(DEVICE_CODE_PATH)?)
        .json(&json!({ "client_id": CLIENT_ID }));
    let (status, body) = account.send(request).await?;

    if !status.is_success() {
        return Err(failure(FailureKind::Server, said(&body, status)));
    }

    let device_code = text(&body, "device_code").ok_or_else(|| {
        failure(
            FailureKind::Server,
            "The server answered without a device code.",
        )
    })?;
    let user_code = text(&body, "user_code").ok_or_else(|| {
        failure(
            FailureKind::Server,
            "The server answered without a user code.",
        )
    })?;
    let verification_uri = text(&body, "verification_uri_complete")
        .or_else(|| text(&body, "verification_uri"))
        .ok_or_else(|| {
            failure(
                FailureKind::Server,
                "The server answered without a page to confirm on.",
            )
        })?;

    *account.pending.lock().await = Some(device_code);

    Ok(SignInStart {
        expires_in: body["expires_in"].as_u64().unwrap_or(1800),
        interval: body["interval"].as_u64().unwrap_or(5),
        user_code,
        verification_uri,
    })
}

#[tauri::command]
pub async fn account_sign_in_poll(
    account: State<'_, Account>,
) -> Result<SignInPoll, AccountFailure> {
    let device_code = account
        .pending
        .lock()
        .await
        .clone()
        .ok_or_else(|| failure(FailureKind::Server, NO_SIGN_IN_PENDING))?;

    let request = account
        .client
        .post(account.url(DEVICE_TOKEN_PATH)?)
        .json(&json!({
            "grant_type": DEVICE_GRANT,
            "device_code": device_code,
            "client_id": CLIENT_ID,
        }));
    let (status, body) = account.send(request).await?;

    if status.is_success() {
        let token = text(&body, "access_token")
            .ok_or_else(|| failure(FailureKind::Server, "The sign-in answered without a token."))?;
        store_token(&token)?;
        *account.pending.lock().await = None;
        return Ok(SignInPoll::SignedIn);
    }

    let outcome = match body["error"].as_str() {
        Some("authorization_pending") => SignInPoll::Pending,
        Some("slow_down") => SignInPoll::SlowDown,
        Some("expired_token") => SignInPoll::Expired,
        Some("access_denied") => SignInPoll::Denied,
        Some("device_limit") => SignInPoll::DeviceLimit {
            devices: body["devices"].clone(),
            message: said(&body, status),
        },
        _ => return Err(failure(FailureKind::Server, said(&body, status))),
    };

    if !matches!(outcome, SignInPoll::Pending | SignInPoll::SlowDown) {
        *account.pending.lock().await = None;
    }

    Ok(outcome)
}

#[tauri::command]
pub async fn account_sign_in_cancel(account: State<'_, Account>) -> Result<(), AccountFailure> {
    *account.pending.lock().await = None;
    Ok(())
}

#[tauri::command]
pub async fn account_me(account: State<'_, Account>) -> Result<Value, AccountFailure> {
    account
        .signed(account.client.get(account.url(ME_PATH)?))
        .await
}

#[tauri::command]
pub async fn account_entitlement(account: State<'_, Account>) -> Result<Value, AccountFailure> {
    account
        .signed(account.client.get(account.url(ENTITLEMENT_PATH)?))
        .await
}

/// Starts a hosted checkout for one billing period. The page it answers with
/// is opened in the browser; the app never sees a card.
#[tauri::command]
pub async fn account_checkout(
    account: State<'_, Account>,
    period: String,
) -> Result<CheckoutStart, AccountFailure> {
    if period != "month" && period != "year" {
        return Err(failure(
            FailureKind::Server,
            "The billing period is either month or year.",
        ));
    }
    let body = account
        .signed(
            account
                .client
                .post(account.url(CHECKOUT_PATH)?)
                .json(&json!({ "period": period })),
        )
        .await?;
    let checkout_url = text(&body, "checkout_url").ok_or_else(|| {
        failure(
            FailureKind::Server,
            "The server answered without a checkout page.",
        )
    })?;
    Ok(CheckoutStart { checkout_url })
}

/// A link into the billing portal — the card and the invoices live there.
#[tauri::command]
pub async fn account_portal(account: State<'_, Account>) -> Result<PortalLink, AccountFailure> {
    let body = account
        .signed(account.client.post(account.url(PORTAL_PATH)?))
        .await?;
    let url = text(&body, "url").ok_or_else(|| {
        failure(
            FailureKind::Server,
            "The server answered without a billing portal link.",
        )
    })?;
    Ok(PortalLink { url })
}

#[tauri::command]
pub async fn account_revoke_device(
    account: State<'_, Account>,
    id: String,
) -> Result<(), AccountFailure> {
    let path = format!(
        "/api/studio/devices/{}/revoke",
        percent_encoding::utf8_percent_encode(&id, percent_encoding::NON_ALPHANUMERIC)
    );
    account
        .signed(account.client.post(account.url(&path)?))
        .await?;
    Ok(())
}

#[tauri::command]
pub async fn account_sign_out(account: State<'_, Account>) -> Result<(), AccountFailure> {
    if let Some(token) = read_token()? {
        let _ = account
            .send(
                account
                    .client
                    .post(account.url(SIGN_OUT_PATH)?)
                    .bearer_auth(token),
            )
            .await;
    }
    clear_token()
}

fn origin() -> Option<String> {
    std::env::var(ORIGIN_ENV)
        .ok()
        .or_else(|| option_env!("REMOCN_STUDIO_ACCOUNT_URL").map(str::to_string))
        .map(|value| value.trim().trim_end_matches('/').to_string())
        .filter(|value| !value.is_empty())
}

fn device_name() -> String {
    ["ComputerName", "LocalHostName"]
        .iter()
        .filter_map(|key| {
            Command::new("/usr/sbin/scutil")
                .arg("--get")
                .arg(key)
                .output()
                .ok()
                .and_then(|output| String::from_utf8(output.stdout).ok())
        })
        .map(|name| header_safe(name.trim()))
        .find(|name| !name.is_empty())
        .unwrap_or_else(|| "Mac".to_string())
}

fn header_safe(name: &str) -> String {
    name.chars()
        .filter(|c| c.is_ascii_graphic() || *c == ' ')
        .filter(|c| !matches!(c, ';' | '(' | ')'))
        .collect::<String>()
        .trim()
        .to_string()
}

fn entry() -> Result<Entry, AccountFailure> {
    Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT)
        .map_err(|err| failure(FailureKind::Keychain, keychain_message(err)))
}

fn read_token() -> Result<Option<String>, AccountFailure> {
    match entry()?.get_password() {
        Ok(token) => Ok(Some(token)),
        Err(KeyringError::NoEntry) => Ok(None),
        Err(err) => Err(failure(FailureKind::Keychain, keychain_message(err))),
    }
}

fn store_token(token: &str) -> Result<(), AccountFailure> {
    entry()?
        .set_password(token)
        .map_err(|err| failure(FailureKind::Keychain, keychain_message(err)))
}

fn clear_token() -> Result<(), AccountFailure> {
    match entry()?.delete_credential() {
        Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
        Err(err) => Err(failure(FailureKind::Keychain, keychain_message(err))),
    }
}

fn keychain_message(err: KeyringError) -> String {
    format!("The keychain refused: {err}")
}

fn failure(kind: FailureKind, message: impl Into<String>) -> AccountFailure {
    AccountFailure {
        kind,
        message: message.into(),
    }
}

fn text(body: &Value, key: &str) -> Option<String> {
    body[key].as_str().map(str::to_string)
}

fn said(body: &Value, status: StatusCode) -> String {
    ["message", "error_description", "error"]
        .iter()
        .find_map(|key| text(body, key))
        .filter(|message| !message.is_empty())
        .unwrap_or_else(|| format!("The server answered {status}."))
}
