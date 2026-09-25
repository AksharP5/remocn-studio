use std::fs;
use std::path::Path;

use keyring::{Entry, Error as KeyringError};
use tauri::{AppHandle, Manager};

const KEYCHAIN_SERVICE: &str = "com.remocn.remocn-studio";
const SESSION_TOKEN: &str = "session-token";
const ENTITLEMENT_CACHE: &str = "entitlement.json";

pub fn forget(app: &AppHandle) {
    let Ok(dir) = app.path().app_data_dir() else {
        return;
    };
    let cache = dir.join(ENTITLEMENT_CACHE);
    tauri::async_runtime::spawn_blocking(move || {
        clean(&cache, delete_token);
    });
}

fn delete_token() -> Result<(), String> {
    match Entry::new(KEYCHAIN_SERVICE, SESSION_TOKEN).and_then(|entry| entry.delete_credential()) {
        Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
        Err(err) => Err(err.to_string()),
    }
}

fn clean(cache: &Path, delete: impl FnOnce() -> Result<(), String>) -> bool {
    if !cache.exists() {
        return false;
    }
    if let Err(err) = delete() {
        eprintln!("legacy account: the old session token was not deleted: {err}");
    }
    if let Err(err) = fs::remove_file(cache) {
        eprintln!("legacy account: {} was not removed: {err}", cache.display());
    }
    true
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::Cell;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn scratch(name: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!(
            "legacy-account-{name}-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&root).unwrap();
        root.join(ENTITLEMENT_CACHE)
    }

    fn tidy(cache: &Path) {
        let _ = fs::remove_dir_all(cache.parent().unwrap());
    }

    #[test]
    fn a_cache_left_behind_deletes_the_token_and_then_itself() {
        let cache = scratch("present");
        fs::write(&cache, "{}").unwrap();
        let asked = Cell::new(false);

        assert!(clean(&cache, || {
            asked.set(true);
            Ok(())
        }));
        assert!(asked.get());
        assert!(!cache.exists());
        tidy(&cache);
    }

    #[test]
    fn no_cache_leaves_the_keychain_alone() {
        let cache = scratch("absent");
        let asked = Cell::new(false);

        assert!(!clean(&cache, || {
            asked.set(true);
            Ok(())
        }));
        assert!(!asked.get());
        tidy(&cache);
    }

    #[test]
    fn a_refused_delete_still_removes_the_cache_so_it_is_not_retried() {
        let cache = scratch("refused");
        fs::write(&cache, "{}").unwrap();

        assert!(clean(&cache, || Err("denied".to_string())));
        assert!(!cache.exists());
        assert!(!clean(&cache, || panic!("asked the keychain twice")));
        tidy(&cache);
    }
}
