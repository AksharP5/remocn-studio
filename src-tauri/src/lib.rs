mod commands;
mod crash;
mod ipc;
mod paste;
mod sidecar;
mod terminal;

use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use tauri::{Emitter, Manager, RunEvent, WindowEvent};

use ipc::QUIT_EVENT;
use sidecar::Sidecar;

static QUIT_CONFIRMED: AtomicBool = AtomicBool::new(false);

pub fn confirm_quit() {
    QUIT_CONFIRMED.store(true, Ordering::SeqCst);
}

fn asked_to_quit() -> bool {
    QUIT_CONFIRMED.load(Ordering::SeqCst)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // `generate_context!()` is bound rather than passed straight to `build`,
    // because the consent has to be read before the builder runs — a panic
    // while the app is being built is one of the crashes this exists to catch,
    // and there is no `AppHandle` yet to ask where the data directory is. The
    // identifier in the context is what locates it.
    let context = tauri::generate_context!();
    let version = context.package_info().version.to_string();

    // Held for the life of the process: dropping the guard flushes the queue
    // and shuts the transport down. `None` — no DSN, a development build, or
    // the feature off — means nothing was started at all, which is the shape
    // #268 asks for: not initialised-and-silent.
    let _crash_reporter = crash::data_dir_for(&context.config().identifier)
        .filter(|data_dir| crash::consent_in(data_dir))
        .and_then(|_| crash::start(&version));

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            commands::quit_studio,
            commands::reveal_studio,
            commands::restart_studio,
            commands::sidecar_cancel,
            commands::sidecar_request,
            commands::sidecar_restart,
            commands::sidecar_status,
            commands::studio_build,
            paste::save_pasted_image,
            paste::save_proxy,
            terminal::open_terminal,
        ])
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if !asked_to_quit() {
                    api.prevent_close();
                    let _ = window.emit(QUIT_EVENT, ());
                }
            }
        })
        .setup(|app| {
            app.manage(Sidecar::start(app.handle().clone()));

            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(Duration::from_millis(1500)).await;
                if let Some(window) = handle.get_webview_window("main") {
                    let _ = window.show();
                }
            });
            Ok(())
        })
        .build(context)
        .expect("error while building tauri application");

    app.run(|app, event| match event {
        RunEvent::ExitRequested { api, .. } if !asked_to_quit() => {
            api.prevent_exit();
            let _ = app.emit(QUIT_EVENT, ());
        }
        RunEvent::Exit => app.state::<Sidecar>().shutdown(),
        _ => {}
    });
}
