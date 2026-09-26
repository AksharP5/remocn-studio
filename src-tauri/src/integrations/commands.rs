use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};

use super::{
    lifecycle,
    provider::{Checked, Keychain},
    store, Connection, ConnectionState, Integrations,
};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Offered {
    pub authorization: Vec<String>,
    pub capabilities: Vec<String>,
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Draft {
    pub authorization: String,
    pub provider: String,
    pub secret: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Attempted {
    pub account: Option<String>,
    pub capabilities: Vec<String>,
    pub provider: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Removed {
    pub detail: Option<String>,
    pub withdrawn: bool,
}

const NO_ATTEMPT: &str = "There is no connection waiting to be named.";
const NO_PROVIDER: &str = "The studio has no adapter for that service.";

#[tauri::command]
pub fn integrations_catalogue(integrations: State<'_, Integrations>) -> Vec<Offered> {
    integrations
        .registry
        .catalogue()
        .into_iter()
        .map(|one| Offered {
            authorization: one.authorization.iter().map(|x| (*x).to_string()).collect(),
            capabilities: one.capabilities.iter().map(|x| (*x).to_string()).collect(),
            id: one.id.to_string(),
            name: one.name.to_string(),
        })
        .collect()
}

#[tauri::command]
pub fn integrations_list(
    app: AppHandle,
    integrations: State<'_, Integrations>,
) -> Result<Vec<Connection>, String> {
    super::connections(&app, &integrations)
}

#[tauri::command]
pub async fn integrations_begin(
    integrations: State<'_, Integrations>,
    draft: Draft,
) -> Result<Attempted, String> {
    let checked = {
        let adapter = integrations
            .registry
            .find(&draft.provider)
            .ok_or_else(|| NO_PROVIDER.to_string())?;

        lifecycle::check_secret(adapter, draft.secret.as_deref()).await?
    };

    integrations.hold(&draft.provider, draft.secret.clone(), checked.clone());

    Ok(Attempted {
        account: checked.account,
        capabilities: checked.capabilities,
        provider: draft.provider,
    })
}

#[tauri::command]
pub fn integrations_cancel(integrations: State<'_, Integrations>) {
    integrations.drop_attempt();
}

#[tauri::command]
pub async fn integrations_confirm(app: AppHandle, name: String) -> Result<Connection, String> {
    crate::paste::off_the_main_thread(move || confirm(&app, &name)).await
}

fn confirm(app: &AppHandle, name: &str) -> Result<Connection, String> {
    let integrations = app.state::<Integrations>();
    let held = integrations.held().ok_or_else(|| NO_ATTEMPT.to_string())?;
    let records = store::read(app)?;
    let id = integrations.next_id();

    let made = lifecycle::created(
        &records,
        &Keychain,
        &id,
        &held.provider,
        name,
        &held.checked,
        held.secret.as_deref(),
    )?;

    store::write(app, &made.records)?;
    integrations.drop_attempt();
    integrations.mark(&id, ConnectionState::Connected, None);

    Ok(super::viewed(&made.record, integrations.seen(&id)))
}

#[tauri::command]
pub async fn integrations_check(
    app: AppHandle,
    integrations: State<'_, Integrations>,
    id: String,
) -> Result<Connection, String> {
    let records = store::read(&app)?;
    let existing = store::find(&records, &id).ok_or_else(|| NO_GONE.to_string())?;

    integrations.mark(&id, ConnectionState::Checking, None);

    let secret = existing
        .secret_reference
        .as_deref()
        .and_then(|reference| super::keychain::read(reference).ok().flatten());

    let checked = {
        let adapter = integrations
            .registry
            .find(&existing.provider)
            .ok_or_else(|| NO_PROVIDER.to_string())?;

        lifecycle::check_secret(adapter, secret.as_deref()).await
    };

    match checked {
        Ok(proved) => {
            let updated = lifecycle::reauthorized(&records, &Keychain, &id, &proved, None)?;
            store::write(&app, &updated.records)?;
            integrations.mark(&id, ConnectionState::Connected, None);
            Ok(super::viewed(&updated.record, integrations.seen(&id)))
        }
        Err(reason) => {
            integrations.mark(&id, ConnectionState::NeedsAuthorization, Some(reason));
            Ok(super::viewed(&existing, integrations.seen(&id)))
        }
    }
}

#[tauri::command]
pub async fn integrations_reconfigure(
    app: AppHandle,
    integrations: State<'_, Integrations>,
    id: String,
    secret: String,
) -> Result<Connection, String> {
    let records = store::read(&app)?;
    let existing = store::find(&records, &id).ok_or_else(|| NO_GONE.to_string())?;

    let checked: Checked = {
        let adapter = integrations
            .registry
            .find(&existing.provider)
            .ok_or_else(|| NO_PROVIDER.to_string())?;

        lifecycle::check_secret(adapter, Some(&secret)).await?
    };

    integrations.invalidate(&id);
    let updated = lifecycle::reauthorized(&records, &Keychain, &id, &checked, Some(&secret))?;
    store::write(&app, &updated.records)?;
    integrations.mark(&id, ConnectionState::Connected, None);

    Ok(super::viewed(&updated.record, integrations.seen(&id)))
}

#[tauri::command]
pub fn integrations_set_disabled(
    app: AppHandle,
    integrations: State<'_, Integrations>,
    id: String,
    disabled: bool,
) -> Result<Connection, String> {
    let records = store::read(&app)?;
    integrations.invalidate(&id);
    let updated = lifecycle::set_disabled(&records, &id, disabled)?;
    store::write(&app, &updated.records)?;

    Ok(super::viewed(&updated.record, integrations.seen(&id)))
}

#[tauri::command]
pub async fn integrations_remove(
    app: AppHandle,
    integrations: State<'_, Integrations>,
    id: String,
) -> Result<Removed, String> {
    let records = store::read(&app)?;
    let existing = store::find(&records, &id).ok_or_else(|| NO_GONE.to_string())?;

    let gone = {
        let adapter = integrations.registry.find(&existing.provider);
        lifecycle::removed(&records, &Keychain, adapter, &id).await?
    };

    store::write(&app, &gone.records)?;
    integrations.forget(&id);

    Ok(Removed {
        detail: gone.detail,
        withdrawn: gone.withdrawn,
    })
}

const NO_GONE: &str = "That connection is no longer here.";
