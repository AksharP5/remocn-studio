use super::{
    keychain,
    provider::{Adapter, Checked, Secrets},
    store::{self, Record},
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Outcome {
    pub records: Vec<Record>,
    pub record: Record,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Removal {
    pub records: Vec<Record>,
    pub withdrawn: bool,
    pub detail: Option<String>,
}

pub fn taken(records: &[Record], provider: &str, name: &str) -> bool {
    store::named(records, provider, name)
}

pub async fn check_secret(
    adapter: &dyn Adapter,
    secret: Option<&str>,
) -> Result<Checked, String> {
    adapter.check(secret).await
}

pub fn created(
    records: &[Record],
    secrets: &dyn Secrets,
    id: &str,
    provider: &str,
    name: &str,
    checked: &Checked,
    secret: Option<&str>,
) -> Result<Outcome, String> {
    if taken(records, provider, name) {
        return Err(format!(
            "You already have a {provider} connection called “{name}”."
        ));
    }

    let reference = match secret {
        Some(value) => {
            let reference = keychain::reference_for(id);
            secrets.store(&reference, value)?;
            Some(reference)
        }
        None => None,
    };

    let record = Record {
        id: id.to_string(),
        provider: provider.to_string(),
        name: name.to_string(),
        account: checked.account.clone(),
        capabilities: checked.capabilities.clone(),
        disabled: false,
        secret_reference: reference,
    };

    Ok(Outcome {
        records: store::upserted(records, record.clone()),
        record,
    })
}

pub fn reauthorized(
    records: &[Record],
    secrets: &dyn Secrets,
    id: &str,
    checked: &Checked,
    secret: Option<&str>,
) -> Result<Outcome, String> {
    let Some(existing) = store::find(records, id) else {
        return Err("That connection is no longer here.".to_string());
    };

    if let (Some(known), Some(found)) = (existing.account.as_deref(), checked.account.as_deref()) {
        if known != found {
            return Err(format!(
                "That signed in as {found}, but this connection is {known}. Reconnect as {known}, or add a second connection."
            ));
        }
    }

    if let Some(value) = secret {
        let reference = existing
            .secret_reference
            .clone()
            .unwrap_or_else(|| keychain::reference_for(id));
        secrets.store(&reference, value)?;

        let record = Record {
            account: checked.account.clone().or(existing.account.clone()),
            capabilities: checked.capabilities.clone(),
            secret_reference: Some(reference),
            ..existing
        };

        return Ok(Outcome {
            records: store::upserted(records, record.clone()),
            record,
        });
    }

    let record = Record {
        account: checked.account.clone().or(existing.account.clone()),
        capabilities: checked.capabilities.clone(),
        ..existing
    };

    Ok(Outcome {
        records: store::upserted(records, record.clone()),
        record,
    })
}

pub fn set_disabled(records: &[Record], id: &str, disabled: bool) -> Result<Outcome, String> {
    let Some(existing) = store::find(records, id) else {
        return Err("That connection is no longer here.".to_string());
    };

    let record = Record {
        disabled,
        ..existing
    };

    Ok(Outcome {
        records: store::upserted(records, record.clone()),
        record,
    })
}

pub async fn removed(
    records: &[Record],
    secrets: &dyn Secrets,
    adapter: Option<&dyn Adapter>,
    id: &str,
) -> Result<Removal, String> {
    let Some(existing) = store::find(records, id) else {
        return Err("That connection is no longer here.".to_string());
    };

    let secret = existing
        .secret_reference
        .as_deref()
        .and_then(|reference| secrets.read(reference).ok().flatten());

    let (withdrawn, detail) = match (adapter, secret.as_deref()) {
        (Some(adapter), Some(secret)) => match adapter.withdraw(secret).await {
            Ok(true) => (true, None),
            Ok(false) => (
                false,
                Some(format!(
                    "{} offers no way to withdraw a credential, so it may still be valid there.",
                    existing.provider
                )),
            ),
            Err(reason) => (false, Some(reason)),
        },
        _ => (false, None),
    };

    if let Some(reference) = existing.secret_reference.as_deref() {
        secrets.clear(reference)?;
    }

    Ok(Removal {
        records: store::without(records, id),
        withdrawn,
        detail,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::integrations::provider::fake::{Sounds, Vault};

    fn checked(account: &str) -> Checked {
        Checked {
            account: Some(account.to_string()),
            capabilities: vec!["audio".to_string()],
        }
    }

    #[tokio::test]
    async fn one_manager_drives_an_adapter_through_its_whole_life() {
        let sounds = Sounds::accepting("sk-1");
        let vault = Vault::default();
        let records: Vec<Record> = Vec::new();

        let proved = check_secret(&sounds, Some("sk-1"))
            .await
            .expect("the key is accepted");
        let made = created(
            &records,
            &vault,
            "cn_1",
            "sounds",
            "Mine",
            &proved,
            Some("sk-1"),
        )
        .expect("a connection is made");

        assert_eq!(made.records.len(), 1);
        assert_eq!(made.record.account, Some("mine@sounds".to_string()));
        assert!(vault.holds("integration:cn_1"));

        let off = set_disabled(&made.records, "cn_1", true).expect("it can be disabled");
        assert!(off.record.disabled);

        let on = set_disabled(&off.records, "cn_1", false).expect("it can be enabled");
        assert!(!on.record.disabled);

        *sounds.accepts.lock().expect("the fake is not poisoned") = "sk-2".to_string();
        let again = check_secret(&sounds, Some("sk-2"))
            .await
            .expect("the new key is accepted");
        let back = reauthorized(&on.records, &vault, "cn_1", &again, Some("sk-2"))
            .expect("it can be reconnected");

        assert_eq!(back.records.len(), 1);
        assert_eq!(vault.count(), 1);

        let gone = removed(&back.records, &vault, Some(&sounds), "cn_1")
            .await
            .expect("it can be removed");

        assert!(gone.records.is_empty());
        assert!(gone.withdrawn);
        assert!(!vault.holds("integration:cn_1"));
    }

    #[tokio::test]
    async fn a_key_the_service_rejects_makes_no_connection() {
        let sounds = Sounds::accepting("sk-1");
        let vault = Vault::default();

        let refused = check_secret(&sounds, Some("wrong")).await;

        assert_eq!(refused, Err("Sounds rejected the key.".to_string()));
        assert_eq!(vault.count(), 0);
    }

    #[tokio::test]
    async fn a_keychain_that_refuses_makes_no_connection() {
        let sounds = Sounds::accepting("sk-1");
        let vault = Vault::default();
        *vault.refuses.lock().expect("the fake is not poisoned") = true;

        let proved = check_secret(&sounds, Some("sk-1"))
            .await
            .expect("the key is accepted");
        let made = created(&[], &vault, "cn_1", "sounds", "Mine", &proved, Some("sk-1"));

        assert!(made.is_err());
        assert_eq!(vault.count(), 0);
    }

    #[test]
    fn a_name_another_connection_of_that_service_already_has_is_refused() {
        let vault = Vault::default();
        let first = created(&[], &vault, "cn_1", "sounds", "Mine", &checked("a"), None)
            .expect("the first is made");

        let clash = created(
            &first.records,
            &vault,
            "cn_2",
            "sounds",
            "Mine",
            &checked("b"),
            None,
        );

        assert!(clash.is_err());
        assert_eq!(first.records.len(), 1);
    }

    #[test]
    fn the_same_name_under_another_service_is_fine() {
        let vault = Vault::default();
        let first = created(&[], &vault, "cn_1", "sounds", "Mine", &checked("a"), None)
            .expect("the first is made");
        let second = created(
            &first.records,
            &vault,
            "cn_2",
            "figma",
            "Mine",
            &checked("b"),
            None,
        )
        .expect("a different service may reuse the name");

        assert_eq!(second.records.len(), 2);
    }

    #[test]
    fn reconnecting_one_account_leaves_the_other_alone() {
        let vault = Vault::default();
        let work = created(
            &[],
            &vault,
            "cn_work",
            "sounds",
            "Work",
            &checked("work@sounds"),
            Some("sk-work"),
        )
        .expect("work is made");
        let home = created(
            &work.records,
            &vault,
            "cn_home",
            "sounds",
            "Home",
            &checked("home@sounds"),
            Some("sk-home"),
        )
        .expect("home is made");

        let back = reauthorized(
            &home.records,
            &vault,
            "cn_work",
            &checked("work@sounds"),
            Some("sk-work-2"),
        )
        .expect("work reconnects");

        assert_eq!(
            vault
                .read("integration:cn_home")
                .expect("the vault answers"),
            Some("sk-home".to_string())
        );
        assert_eq!(
            vault
                .read("integration:cn_work")
                .expect("the vault answers"),
            Some("sk-work-2".to_string())
        );
        assert_eq!(back.records.len(), 2);
    }

    #[test]
    fn authorizing_as_a_different_account_is_refused_rather_than_rebound() {
        let vault = Vault::default();
        let made = created(
            &[],
            &vault,
            "cn_1",
            "sounds",
            "Work",
            &checked("work@sounds"),
            Some("sk-1"),
        )
        .expect("work is made");

        let wrong = reauthorized(
            &made.records,
            &vault,
            "cn_1",
            &checked("someone-else@sounds"),
            Some("sk-2"),
        );

        assert!(wrong.is_err());
        assert!(
            wrong
                .expect_err("it is refused")
                .contains("someone-else@sounds")
        );
    }

    #[tokio::test]
    async fn a_service_that_cannot_be_told_still_loses_the_local_secret() {
        let sounds = Sounds::accepting("sk-1");
        *sounds.reachable.lock().expect("the fake is not poisoned") = true;
        let vault = Vault::default();

        let proved = check_secret(&sounds, Some("sk-1"))
            .await
            .expect("the key is accepted");
        let made = created(
            &[],
            &vault,
            "cn_1",
            "sounds",
            "Mine",
            &proved,
            Some("sk-1"),
        )
        .expect("a connection is made");

        struct Deaf;

        impl Adapter for Deaf {
            fn describe(&self) -> crate::integrations::provider::Descriptor {
                crate::integrations::provider::Descriptor {
                    id: "sounds",
                    name: "Sounds",
                    authorization: vec!["api-key"],
                    capabilities: vec!["audio"],
                }
            }

            fn check<'a>(
                &'a self,
                _secret: Option<&'a str>,
            ) -> crate::integrations::provider::Answering<'a, Checked> {
                Box::pin(async { Err("unused".to_string()) })
            }

            fn withdraw<'a>(
                &'a self,
                _secret: &'a str,
            ) -> crate::integrations::provider::Answering<'a, bool> {
                Box::pin(async { Err("Sounds could not be reached.".to_string()) })
            }
        }

        let gone = removed(&made.records, &vault, Some(&Deaf), "cn_1")
            .await
            .expect("removal completes anyway");

        assert!(gone.records.is_empty());
        assert!(!gone.withdrawn);
        assert_eq!(gone.detail, Some("Sounds could not be reached.".to_string()));
        assert!(!vault.holds("integration:cn_1"));
    }

    #[tokio::test]
    async fn removing_something_that_is_already_gone_is_said_plainly() {
        let vault = Vault::default();
        let gone = removed(&[], &vault, None, "cn_1").await;

        assert_eq!(gone, Err("That connection is no longer here.".to_string()));
    }
}
