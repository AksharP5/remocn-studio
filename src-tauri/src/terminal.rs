use std::process::Command;

const OPEN_WINDOW: &str = r#"tell application "Terminal" to do script """#;
const ACTIVATE: &str = r#"tell application "Terminal" to activate"#;

#[tauri::command]
pub fn open_terminal() -> Result<(), String> {
    let status = Command::new("/usr/bin/osascript")
        .arg("-e")
        .arg(OPEN_WINDOW)
        .arg("-e")
        .arg(ACTIVATE)
        .status()
        .map_err(|err| format!("could not run osascript: {err}"))?;

    if status.success() {
        Ok(())
    } else {
        Err(format!("Terminal did not open ({status})"))
    }
}
