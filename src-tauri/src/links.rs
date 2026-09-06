use std::sync::Mutex;

use tauri::{AppHandle, Emitter, Manager, State};

use crate::ipc::DEEP_LINK_EVENT;

// Every URL the app is handed waits here until the webview asks for it. A link
// that started the app arrives before any page is listening, and a link into a
// running app arrives while one is — the queue is the one path both take, and
// the event is only a nudge to come and read it.
#[derive(Default)]
pub struct DeepLinks {
    pending: Mutex<Vec<String>>,
}

impl DeepLinks {
    pub fn push(&self, urls: impl IntoIterator<Item = String>) {
        let mut pending = self.pending.lock().unwrap_or_else(|poison| poison.into_inner());
        pending.extend(urls);
    }

    pub fn take(&self) -> Vec<String> {
        let mut pending = self.pending.lock().unwrap_or_else(|poison| poison.into_inner());
        std::mem::take(&mut *pending)
    }
}

pub fn receive(app: &AppHandle, urls: impl IntoIterator<Item = String>) {
    app.state::<DeepLinks>().push(urls);
    let _ = app.emit(DEEP_LINK_EVENT, ());
    focus(app);
}

pub fn focus(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

#[tauri::command]
pub fn take_deep_links(links: State<'_, DeepLinks>) -> Vec<String> {
    links.take()
}
