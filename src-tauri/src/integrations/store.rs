use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Runtime};
use tauri_plugin_store::StoreExt;

const SETTINGS_FILE: &str = "settings.json";
const SETTINGS_KEY: &str = "integrations";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Record {
    pub id: String,
    pub provider: String,
    pub name: String,
    pub account: Option<String>,
    pub capabilities: Vec<String>,
    pub disabled: bool,
    pub secret_reference: Option<String>,
}

pub fn read<R: Runtime>(app: &AppHandle<R>) -> Result<Vec<Record>, String> {
    let store = app
        .store(SETTINGS_FILE)
        .map_err(|err| format!("The studio could not open its settings: {err}"))?;

    let Some(value) = store.get(SETTINGS_KEY) else {
        return Ok(Vec::new());
    };

    serde_json::from_value::<Vec<Record>>(value).or_else(|_| Ok(Vec::new()))
}

pub fn write<R: Runtime>(app: &AppHandle<R>, records: &[Record]) -> Result<(), String> {
    let store = app
        .store(SETTINGS_FILE)
        .map_err(|err| format!("The studio could not open its settings: {err}"))?;

    let encoded = serde_json::to_value(records)
        .map_err(|err| format!("The studio could not write your connections down: {err}"))?;

    store.set(SETTINGS_KEY, encoded);
    store
        .save()
        .map_err(|err| format!("The studio could not save your connections: {err}"))
}

pub fn find(records: &[Record], id: &str) -> Option<Record> {
    records.iter().find(|record| record.id == id).cloned()
}

pub fn named(records: &[Record], provider: &str, name: &str) -> bool {
    records
        .iter()
        .any(|record| record.provider == provider && record.name == name)
}

pub fn without(records: &[Record], id: &str) -> Vec<Record> {
    records
        .iter()
        .filter(|record| record.id != id)
        .cloned()
        .collect()
}

pub fn upserted(records: &[Record], record: Record) -> Vec<Record> {
    let mut kept = without(records, &record.id);
    kept.push(record);
    kept
}

pub fn carries_secret(value: &Value) -> bool {
    const NEVER: [&str; 6] = [
        "secret",
        "apiKey",
        "api_key",
        "token",
        "accessToken",
        "refreshToken",
    ];

    match value {
        Value::Object(fields) => fields
            .iter()
            .any(|(key, nested)| NEVER.contains(&key.as_str()) || carries_secret(nested)),
        Value::Array(items) => items.iter().any(carries_secret),
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn record(id: &str, provider: &str, name: &str) -> Record {
        Record {
            id: id.to_string(),
            provider: provider.to_string(),
            name: name.to_string(),
            account: Some("studio@remocn.dev".to_string()),
            capabilities: vec!["audio".to_string()],
            disabled: false,
            secret_reference: Some(format!("integration:{id}")),
        }
    }

    #[test]
    fn a_record_round_trips_through_json() {
        let one = record("cn_1", "elevenlabs", "Mine");
        let encoded = serde_json::to_value(&one).expect("a record should encode");
        let decoded: Record = serde_json::from_value(encoded).expect("a record should decode");

        assert_eq!(decoded, one);
    }

    #[test]
    fn what_a_record_carries_is_never_a_secret() {
        let one = record("cn_1", "elevenlabs", "Mine");
        let encoded = serde_json::to_value(&one).expect("a record should encode");

        assert!(!carries_secret(&encoded));
    }

    #[test]
    fn a_secret_shaped_field_is_caught_wherever_it_hides() {
        let flat = serde_json::json!({ "id": "cn_1", "secret": "sk-live" });
        let nested = serde_json::json!({ "id": "cn_1", "auth": { "refreshToken": "rt" } });
        let listed = serde_json::json!([{ "id": "cn_1" }, { "apiKey": "sk-live" }]);

        assert!(carries_secret(&flat));
        assert!(carries_secret(&nested));
        assert!(carries_secret(&listed));
    }

    #[test]
    fn two_accounts_of_one_service_do_not_overwrite_each_other() {
        let records = vec![record("cn_1", "elevenlabs", "Work")];
        let both = upserted(&records, record("cn_2", "elevenlabs", "Personal"));

        assert_eq!(both.len(), 2);
        assert!(find(&both, "cn_1").is_some());
        assert!(find(&both, "cn_2").is_some());
    }

    #[test]
    fn replacing_a_record_leaves_the_other_alone() {
        let records = vec![
            record("cn_1", "elevenlabs", "Work"),
            record("cn_2", "elevenlabs", "Personal"),
        ];

        let mut renamed = record("cn_1", "elevenlabs", "Renamed");
        renamed.account = Some("other@remocn.dev".to_string());
        let after = upserted(&records, renamed);

        assert_eq!(after.len(), 2);
        assert_eq!(find(&after, "cn_1").expect("cn_1 is there").name, "Renamed");
        assert_eq!(
            find(&after, "cn_2").expect("cn_2 is there").account,
            Some("studio@remocn.dev".to_string())
        );
    }

    #[test]
    fn a_name_already_taken_by_the_same_provider_is_seen() {
        let records = vec![record("cn_1", "elevenlabs", "Work")];

        assert!(named(&records, "elevenlabs", "Work"));
        assert!(!named(&records, "elevenlabs", "Personal"));
        assert!(!named(&records, "figma", "Work"));
    }

    #[test]
    fn removing_a_record_takes_only_that_one() {
        let records = vec![
            record("cn_1", "elevenlabs", "Work"),
            record("cn_2", "figma", "Design"),
        ];
        let after = without(&records, "cn_1");

        assert_eq!(after.len(), 1);
        assert_eq!(after[0].id, "cn_2");
    }
}
