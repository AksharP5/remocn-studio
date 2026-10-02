use serde::Deserialize;
use tauri::{AppHandle, WebviewWindow};

#[derive(Clone, Copy, Deserialize)]
pub enum EditCommand {
    Undo,
    Redo,
    Cut,
    Copy,
    Paste,
    SelectAll,
}

#[cfg(target_os = "linux")]
impl EditCommand {
    fn webkit_command(self) -> &'static str {
        match self {
            Self::Undo => "Undo",
            Self::Redo => "Redo",
            Self::Cut => "Cut",
            Self::Copy => "Copy",
            Self::Paste => "Paste",
            Self::SelectAll => "SelectAll",
        }
    }
}

#[tauri::command]
pub fn edit_webview(window: WebviewWindow, command: EditCommand) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        use webkit2gtk::WebViewExt;

        window
            .with_webview(move |webview| {
                webview
                    .inner()
                    .execute_editing_command(command.webkit_command());
            })
            .map_err(|error| format!("could not edit the focused field: {error}"))
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = (window, command);
        Err("This platform uses its native Edit menu.".to_string())
    }
}

#[tauri::command]
pub async fn post_notification(app: AppHandle, title: String, body: String) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        use notify_rust::{Hint, Notification};
        use tauri::Manager;

        let desktop_entry = app.config().identifier.clone();
        let notification = tauri::async_runtime::spawn_blocking(move || {
            Notification::new()
                .appname("Remocn Studio")
                .summary(&title)
                .body(&body)
                .icon(&desktop_entry)
                .hint(Hint::DesktopEntry(desktop_entry))
                .action("default", "Open Remocn Studio")
                .show()
        })
        .await
        .map_err(|error| format!("could not send a notification: {error}"))?
        .map_err(|error| format!("could not send a notification: {error}"))?;

        // The handle must stay alive for the daemon to deliver click actions.
        // Waiting belongs off both the webview thread and the Tokio pool.
        std::thread::Builder::new()
            .name("notification-action".to_string())
            .spawn(move || {
                notification.wait_for_action(|action| {
                    if action == "default" {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                });
            })
            .map_err(|error| format!("could not listen for notification clicks: {error}"))?;
        Ok(())
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = (app, title, body);
        Err("This platform uses its native notification transport.".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn edit_commands_accept_only_the_native_menu_commands() {
        for command in ["Undo", "Redo", "Cut", "Copy", "Paste", "SelectAll"] {
            assert!(serde_json::from_value::<EditCommand>(serde_json::json!(command)).is_ok());
        }
        assert!(serde_json::from_value::<EditCommand>(serde_json::json!("InsertHTML")).is_err());
    }

    #[cfg(target_os = "linux")]
    #[test]
    #[ignore = "requires an unlocked desktop Secret Service"]
    fn integration_secrets_survive_a_new_keyring_entry() {
        use std::time::{SystemTime, UNIX_EPOCH};

        let reference = format!(
            "linux-verification-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        );
        let entry = keyring::Entry::new("remocn-studio-verification", &reference).unwrap();
        entry.set_password("verification-only").unwrap();
        let stored = keyring::Entry::new("remocn-studio-verification", &reference)
            .unwrap()
            .get_password();
        entry.delete_credential().unwrap();
        assert_eq!(stored.unwrap(), "verification-only");
    }
}
