use std::sync::OnceLock;

use serde_json::Value;
use tauri::{ipc::Channel, AppHandle, Manager, State};

use crate::{
    confirm_quit,
    ipc::{AppEnvironment, SidecarStatus, StudioBuild},
    sidecar::Sidecar,
};

#[tauri::command]
pub async fn sidecar_request(
    sidecar: State<'_, Sidecar>,
    id: String,
    method: String,
    params: Value,
    on_stream: Channel<Value>,
) -> Result<Value, String> {
    sidecar.request(id, method, params, on_stream).await
}

#[tauri::command]
pub fn sidecar_cancel(sidecar: State<'_, Sidecar>, id: String) -> Result<(), String> {
    sidecar.cancel(id)
}

#[tauri::command]
pub fn sidecar_status(sidecar: State<'_, Sidecar>) -> SidecarStatus {
    sidecar.status()
}

#[tauri::command]
pub fn sidecar_restart(sidecar: State<'_, Sidecar>) {
    sidecar.restart();
}

#[tauri::command]
pub fn quit_studio(app: AppHandle) {
    confirm_quit();
    app.exit(0);
}

#[tauri::command]
pub fn restart_studio(app: AppHandle) {
    confirm_quit();
    app.state::<Sidecar>().shutdown();
    app.restart();
}

#[tauri::command]
pub fn reveal_studio(app: AppHandle) -> Result<(), String> {
    app.get_webview_window("main")
        .ok_or_else(|| "the studio window is unavailable".to_string())?
        .show()
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn path_exists(path: String) -> bool {
    tauri::async_runtime::spawn_blocking(move || std::path::Path::new(&path).is_file())
        .await
        .unwrap_or(false)
}

#[tauri::command]
pub async fn studio_build(app: AppHandle) -> StudioBuild {
    let os = tauri::async_runtime::spawn_blocking(os_version)
        .await
        .unwrap_or_else(|_| "unknown".to_string());

    StudioBuild {
        environment: if cfg!(debug_assertions) {
            AppEnvironment::Development
        } else {
            AppEnvironment::Production
        },
        os,
        version: app.package_info().version.to_string(),
    }
}

static OS_VERSION: OnceLock<String> = OnceLock::new();

pub(crate) fn os_version() -> String {
    OS_VERSION.get_or_init(read_os_version).clone()
}

#[cfg(target_os = "macos")]
fn read_os_version() -> String {
    std::process::Command::new("sw_vers")
        .arg("-productVersion")
        .output()
        .ok()
        .and_then(|output| String::from_utf8(output.stdout).ok())
        .map(|version| version.trim().to_string())
        .filter(|version| !version.is_empty())
        .unwrap_or_else(|| "unknown".to_string())
}

#[cfg(target_os = "linux")]
fn read_os_version() -> String {
    std::fs::read_to_string("/etc/os-release")
        .or_else(|_| std::fs::read_to_string("/usr/lib/os-release"))
        .ok()
        .and_then(|release| linux_release(&release))
        .unwrap_or_else(|| "Linux".to_string())
}

#[cfg(not(any(target_os = "macos", target_os = "linux")))]
fn read_os_version() -> String {
    std::env::consts::OS.to_string()
}

#[cfg(target_os = "linux")]
fn linux_release(release: &str) -> Option<String> {
    let field = |name: &str| {
        release.lines().find_map(|line| {
            let (key, value) = line.split_once('=')?;
            if key.trim() != name {
                return None;
            }
            let value = value.trim();
            let value = value
                .strip_prefix('"')
                .and_then(|value| value.strip_suffix('"'))
                .or_else(|| {
                    value
                        .strip_prefix('\'')
                        .and_then(|value| value.strip_suffix('\''))
                })
                .unwrap_or(value);
            (!value.is_empty()).then_some(value)
        })
    };
    let name = field("PRETTY_NAME").or_else(|| field("NAME"))?;
    let version = field("VERSION_ID");
    match version {
        Some(version) if !name.contains(version) => Some(format!("{name} {version}")),
        _ => Some(name.to_string()),
    }
}

#[cfg(all(test, target_os = "linux"))]
mod tests {
    use super::*;

    #[test]
    fn diagnostics_include_the_omarchy_version() {
        assert_eq!(
            linux_release("NAME=\"Omarchy\"\nPRETTY_NAME=\"Omarchy\"\nVERSION_ID=\"4.0.0\"\n"),
            Some("Omarchy 4.0.0".to_string())
        );
    }

    #[test]
    fn diagnostics_keep_a_distributions_own_pretty_name() {
        assert_eq!(
            linux_release("PRETTY_NAME='Ubuntu 24.04 LTS'\nVERSION_ID=24.04\n"),
            Some("Ubuntu 24.04 LTS".to_string())
        );
        assert_eq!(
            linux_release("NAME=Arch Linux\n"),
            Some("Arch Linux".to_string())
        );
        assert_eq!(linux_release("VERSION_ID=42\n"), None);
    }
}
