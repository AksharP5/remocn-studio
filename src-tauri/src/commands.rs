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
pub fn studio_build(app: AppHandle) -> StudioBuild {
    StudioBuild {
        environment: if cfg!(debug_assertions) {
            AppEnvironment::Development
        } else {
            AppEnvironment::Production
        },
        os: macos_version(),
        version: app.package_info().version.to_string(),
    }
}

pub(crate) fn macos_version() -> String {
    std::process::Command::new("sw_vers")
        .arg("-productVersion")
        .output()
        .ok()
        .and_then(|output| String::from_utf8(output.stdout).ok())
        .map(|version| version.trim().to_string())
        .filter(|version| !version.is_empty())
        .unwrap_or_else(|| "unknown".to_string())
}
