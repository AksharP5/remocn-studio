use std::process::Command;

#[cfg(target_os = "macos")]
#[tauri::command]
pub fn open_terminal() -> Result<(), String> {
    const OPEN_WINDOW: &str = r#"tell application "Terminal" to do script """#;
    const ACTIVATE: &str = r#"tell application "Terminal" to activate"#;
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

#[cfg(target_os = "linux")]
#[tauri::command]
pub fn open_terminal() -> Result<(), String> {
    open_available_terminal(|terminal| {
        let mut child = Command::new(terminal).spawn()?;
        std::thread::Builder::new()
            .name("terminal-exit".to_string())
            .spawn(move || {
                if let Err(error) = child.wait() {
                    eprintln!("could not wait for the terminal to exit: {error}");
                }
            })?;
        Ok(())
    })
}

#[cfg(target_os = "linux")]
fn open_available_terminal(
    mut launch: impl FnMut(&str) -> std::io::Result<()>,
) -> Result<(), String> {
    for terminal in [
        "xdg-terminal-exec",
        "ghostty",
        "alacritty",
        "foot",
        "kitty",
        "x-terminal-emulator",
        "gnome-terminal",
        "konsole",
        "xterm",
    ] {
        match launch(terminal) {
            Ok(()) => return Ok(()),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => continue,
            Err(error) => return Err(format!("could not open {terminal}: {error}")),
        }
    }
    Err(
        "No terminal was found. Install a terminal or set one through xdg-terminal-exec."
            .to_string(),
    )
}

#[cfg(not(any(target_os = "macos", target_os = "linux")))]
#[tauri::command]
pub fn open_terminal() -> Result<(), String> {
    Err("Opening a terminal is not supported on this platform.".to_string())
}

#[cfg(all(test, target_os = "linux"))]
mod tests {
    use super::*;
    use std::io::{Error, ErrorKind};

    #[test]
    fn opens_the_desktops_selected_terminal_first() {
        let mut attempts = Vec::new();
        open_available_terminal(|terminal| {
            attempts.push(terminal.to_string());
            Ok(())
        })
        .unwrap();
        assert_eq!(attempts, ["xdg-terminal-exec"]);
    }

    #[test]
    fn uses_an_installed_terminal_when_the_desktop_launcher_is_missing() {
        let mut attempts = Vec::new();
        open_available_terminal(|terminal| {
            attempts.push(terminal.to_string());
            if terminal == "alacritty" {
                Ok(())
            } else {
                Err(Error::from(ErrorKind::NotFound))
            }
        })
        .unwrap();
        assert_eq!(attempts, ["xdg-terminal-exec", "ghostty", "alacritty"]);
    }

    #[test]
    fn reports_launch_failures_instead_of_hiding_them() {
        assert!(
            open_available_terminal(|_| Err(Error::from(ErrorKind::PermissionDenied)))
                .unwrap_err()
                .contains("xdg-terminal-exec")
        );
        assert!(
            open_available_terminal(|_| Err(Error::from(ErrorKind::NotFound)))
                .unwrap_err()
                .contains("No terminal was found")
        );
    }
}
