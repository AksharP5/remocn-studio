use serde_json::Value;

use super::provider::{Adapter, Answering, Checked, Descriptor};

const ENDPOINT: &str = "https://api.figma.com/v1/me";
const HEADER: &str = "X-Figma-Token";

pub struct Figma;

pub fn account_of(body: &Value) -> Option<String> {
    for field in ["email", "handle", "id"] {
        if let Some(value) = body.get(field).and_then(Value::as_str) {
            if !value.is_empty() {
                return Some(value.to_string());
            }
        }
    }

    None
}

pub fn refusal(status: u16) -> String {
    match status {
        401 => "Figma rejected that token. Check it is the whole token and has not expired."
            .to_string(),
        403 => "That Figma token is missing the rights the studio needs. Give it current_user:read and file_content:read, or make a new one."
            .to_string(),
        429 => "Figma is rate-limiting this token. Try again in a minute.".to_string(),
        other => format!("Figma answered with {other}, so the token could not be checked."),
    }
}

impl Adapter for Figma {
    fn describe(&self) -> Descriptor {
        Descriptor {
            id: "figma",
            name: "Figma",
            authorization: vec!["personal-token"],
            capabilities: vec!["import"],
        }
    }

    fn check<'a>(&'a self, secret: Option<&'a str>) -> Answering<'a, Checked> {
        Box::pin(async move {
            let Some(token) = secret else {
                return Err("Figma needs a personal access token.".to_string());
            };

            let answer = reqwest::Client::new()
                .get(ENDPOINT)
                .header(HEADER, token)
                .send()
                .await
                .map_err(|_| "Figma could not be reached.".to_string())?;

            let status = answer.status();
            if !status.is_success() {
                return Err(refusal(status.as_u16()));
            }

            let body: Value = answer
                .json()
                .await
                .map_err(|_| "Figma answered in a shape the studio could not read.".to_string())?;

            Ok(Checked {
                account: account_of(&body),
                capabilities: vec!["import".to_string()],
            })
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_account_reads_as_the_email_when_there_is_one() {
        let body = serde_json::json!({
            "email": "dima@remocn.dev",
            "handle": "dima",
            "id": "123"
        });

        assert_eq!(account_of(&body), Some("dima@remocn.dev".to_string()));
    }

    #[test]
    fn the_account_falls_back_to_the_handle_then_the_identifier() {
        let handled = serde_json::json!({ "handle": "dima", "id": "123" });
        let bare = serde_json::json!({ "id": "123" });

        assert_eq!(account_of(&handled), Some("dima".to_string()));
        assert_eq!(account_of(&bare), Some("123".to_string()));
    }

    #[test]
    fn a_body_naming_nobody_leaves_the_account_unknown() {
        assert_eq!(account_of(&serde_json::json!({})), None);
        assert_eq!(account_of(&serde_json::json!({ "email": "" })), None);
    }

    #[test]
    fn a_token_short_of_rights_is_told_which_rights() {
        let said = refusal(403);

        assert!(said.contains("current_user:read"));
        assert!(said.contains("file_content:read"));
    }

    #[test]
    fn a_rejected_token_is_worded_as_advice() {
        assert!(refusal(401).contains("rejected that token"));
        assert!(refusal(429).contains("rate-limiting"));
        assert!(refusal(500).contains("500"));
    }

    #[tokio::test]
    async fn no_token_is_refused_before_anything_is_sent() {
        let refused = Figma.check(None).await;

        assert_eq!(
            refused,
            Err("Figma needs a personal access token.".to_string())
        );
    }

    #[test]
    fn it_offers_a_token_and_import() {
        let described = Figma.describe();

        assert_eq!(described.id, "figma");
        assert_eq!(described.authorization, vec!["personal-token"]);
        assert_eq!(described.capabilities, vec!["import"]);
    }
}
