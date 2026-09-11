use serde_json::Value;

use super::provider::{Adapter, Answering, Checked, Descriptor};

const ENDPOINT: &str = "https://api.elevenlabs.io/v1/user";
const HEADER: &str = "xi-api-key";

pub struct ElevenLabs;

pub fn account_of(body: &Value) -> Option<String> {
    let named = body.get("first_name").and_then(Value::as_str);
    let identified = body.get("user_id").and_then(Value::as_str);

    match (named, identified) {
        (Some(name), _) if !name.is_empty() => Some(name.to_string()),
        (_, Some(id)) if !id.is_empty() => Some(id.to_string()),
        _ => None,
    }
}

pub fn refusal(status: u16) -> String {
    match status {
        401 | 403 => "ElevenLabs rejected that key. Check it is the whole key and still active.".to_string(),
        429 => "ElevenLabs is rate-limiting this key. Try again in a minute.".to_string(),
        other => format!("ElevenLabs answered with {other}, so the key could not be checked."),
    }
}

impl Adapter for ElevenLabs {
    fn describe(&self) -> Descriptor {
        Descriptor {
            id: "elevenlabs",
            name: "ElevenLabs",
            authorization: vec!["api-key"],
            capabilities: vec!["audio"],
        }
    }

    fn check<'a>(&'a self, secret: Option<&'a str>) -> Answering<'a, Checked> {
        Box::pin(async move {
            let Some(key) = secret else {
                return Err("ElevenLabs needs an API key.".to_string());
            };

            let answer = reqwest::Client::new()
                .get(ENDPOINT)
                .header(HEADER, key)
                .send()
                .await
                .map_err(|_| "ElevenLabs could not be reached.".to_string())?;

            let status = answer.status();
            if !status.is_success() {
                return Err(refusal(status.as_u16()));
            }

            let body: Value = answer
                .json()
                .await
                .map_err(|_| "ElevenLabs answered in a shape the studio could not read.".to_string())?;

            Ok(Checked {
                account: account_of(&body),
                capabilities: vec!["audio".to_string()],
            })
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_account_reads_as_the_name_when_there_is_one() {
        let body = serde_json::json!({ "first_name": "Dima", "user_id": "u_123" });

        assert_eq!(account_of(&body), Some("Dima".to_string()));
    }

    #[test]
    fn the_account_falls_back_to_the_identifier() {
        let body = serde_json::json!({ "user_id": "u_123" });

        assert_eq!(account_of(&body), Some("u_123".to_string()));
    }

    #[test]
    fn an_empty_name_is_not_an_account() {
        let body = serde_json::json!({ "first_name": "", "user_id": "u_123" });

        assert_eq!(account_of(&body), Some("u_123".to_string()));
    }

    #[test]
    fn a_body_naming_nobody_leaves_the_account_unknown() {
        let body = serde_json::json!({ "subscription": { "tier": "free" } });

        assert_eq!(account_of(&body), None);
    }

    #[test]
    fn a_refused_key_is_worded_as_advice() {
        assert!(refusal(401).contains("rejected that key"));
        assert!(refusal(403).contains("rejected that key"));
        assert!(refusal(429).contains("rate-limiting"));
        assert!(refusal(503).contains("503"));
    }

    #[tokio::test]
    async fn no_key_is_refused_before_anything_is_sent() {
        let refused = ElevenLabs.check(None).await;

        assert_eq!(refused, Err("ElevenLabs needs an API key.".to_string()));
    }

    #[test]
    fn it_offers_a_key_and_audio() {
        let described = ElevenLabs.describe();

        assert_eq!(described.id, "elevenlabs");
        assert_eq!(described.authorization, vec!["api-key"]);
        assert_eq!(described.capabilities, vec!["audio"]);
    }
}
