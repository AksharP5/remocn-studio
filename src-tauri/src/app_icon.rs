use serde::Deserialize;

#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum IconTheme {
    Light,
    Dark,
}

impl IconTheme {
    fn bytes(self) -> &'static [u8] {
        match self {
            Self::Light => include_bytes!("../icons/themes/light.png"),
            Self::Dark => include_bytes!("../icons/themes/dark.png"),
        }
    }
}

// Only a resolved theme crosses IPC, never arbitrary image bytes or a path.
#[tauri::command]
pub async fn set_app_icon(app: tauri::AppHandle, theme: IconTheme) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let (send, receive) = tokio::sync::oneshot::channel();
        app.run_on_main_thread(move || {
            let _ = send.send(set_macos_icon(theme));
        })
        .map_err(|error| error.to_string())?;
        receive.await.map_err(|error| error.to_string())?
    }

    #[cfg(not(target_os = "macos"))]
    {
        use tauri::Manager;
        let icon =
            tauri::image::Image::from_bytes(theme.bytes()).map_err(|error| error.to_string())?;
        for window in app.webview_windows().values() {
            window
                .set_icon(icon.clone())
                .map_err(|error| error.to_string())?;
        }
        Ok(())
    }
}

#[cfg(target_os = "macos")]
fn set_macos_icon(theme: IconTheme) -> Result<(), String> {
    use objc2::{AllocAnyThread, MainThreadMarker};
    use objc2_app_kit::{NSApplication, NSImage};
    use objc2_foundation::NSData;

    let main_thread = MainThreadMarker::new().ok_or("App icon requires the main thread")?;
    let data = NSData::with_bytes(theme.bytes());
    let icon =
        NSImage::initWithData(NSImage::alloc(), &data).ok_or("Could not decode the app icon")?;
    let app = NSApplication::sharedApplication(main_thread);
    // SAFETY: AppKit runs on the main thread; `icon` is a valid retained NSImage.
    unsafe { app.setApplicationIconImage(Some(&icon)) };
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::IconTheme;

    #[test]
    fn both_embedded_icons_decode_with_transparent_padding() {
        for theme in [IconTheme::Light, IconTheme::Dark] {
            let icon = tauri::image::Image::from_bytes(theme.bytes()).unwrap();
            assert_eq!((icon.width(), icon.height()), (512, 512));
            assert_eq!(icon.rgba()[3], 0);
            assert_eq!(icon.rgba()[(256 * 512 + 256) * 4 + 3], 255);
        }
        assert_ne!(IconTheme::Light.bytes(), IconTheme::Dark.bytes());
    }

    #[test]
    fn accepts_only_resolved_theme_names() {
        assert!(serde_json::from_str::<IconTheme>("\"light\"").is_ok());
        assert!(serde_json::from_str::<IconTheme>("\"dark\"").is_ok());
        assert!(serde_json::from_str::<IconTheme>("\"system\"").is_err());
        assert!(serde_json::from_str::<IconTheme>("\"/tmp/icon.png\"").is_err());
    }
}
