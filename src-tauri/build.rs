use std::path::Path;

const BAKED: &[&str] = &["REMOCN_STUDIO_ACCOUNT_URL"];

fn main() {
    let env_file = Path::new(env!("CARGO_MANIFEST_DIR")).join("../.env");
    println!("cargo:rerun-if-changed={}", env_file.display());

    let dotenv = std::fs::read_to_string(&env_file).unwrap_or_default();

    for key in BAKED {
        println!("cargo:rerun-if-env-changed={key}");
        let value = std::env::var(key)
            .ok()
            .filter(|value| !value.trim().is_empty())
            .or_else(|| value_in(&dotenv, key));
        if let Some(value) = value {
            println!("cargo:rustc-env={key}={value}");
        }
    }

    tauri_build::build()
}

fn value_in(dotenv: &str, key: &str) -> Option<String> {
    dotenv
        .lines()
        .map(str::trim)
        .filter(|line| !line.starts_with('#'))
        .filter_map(|line| line.split_once('='))
        .find(|(name, _)| name.trim() == key)
        .map(|(_, value)| {
            value
                .trim()
                .trim_matches('"')
                .trim_matches('\'')
                .to_string()
        })
        .filter(|value| !value.is_empty())
}
