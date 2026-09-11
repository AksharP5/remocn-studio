#![allow(dead_code)]

use std::{collections::HashMap, time::Duration};

use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::{TcpListener, TcpStream},
    time::timeout,
};

pub const WAIT: Duration = Duration::from_secs(300);

const PAGE: &str = "You can close this tab and go back to Remocn Studio.";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Returned {
    pub code: String,
    pub state: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Ending {
    Came(Returned),
    Refused(String),
    Waited,
}

pub struct Listening {
    listener: TcpListener,
    pub port: u16,
}

pub fn query_of(target: &str) -> HashMap<String, String> {
    let Some((_, query)) = target.split_once('?') else {
        return HashMap::new();
    };

    query
        .split('&')
        .filter_map(|pair| pair.split_once('='))
        .map(|(key, value)| (decoded(key), decoded(value)))
        .collect()
}

fn decoded(raw: &str) -> String {
    let replaced = raw.replace('+', " ");
    let bytes = replaced.as_bytes();
    let mut out: Vec<u8> = Vec::with_capacity(bytes.len());
    let mut index = 0;

    while index < bytes.len() {
        if bytes[index] == b'%' && index + 2 < bytes.len() {
            let pair = std::str::from_utf8(&bytes[index + 1..index + 3]).unwrap_or("");
            if let Ok(byte) = u8::from_str_radix(pair, 16) {
                out.push(byte);
                index += 3;
                continue;
            }
        }
        out.push(bytes[index]);
        index += 1;
    }

    String::from_utf8_lossy(&out).into_owned()
}

pub fn read_target(request: &str) -> Option<&str> {
    request.lines().next()?.split_whitespace().nth(1)
}

pub fn ending_of(target: &str, expected_state: &str) -> Option<Ending> {
    let query = query_of(target);
    let state = query.get("state")?;

    if state != expected_state {
        return None;
    }

    if let Some(refused) = query.get("error") {
        return Some(Ending::Refused(refusal(refused)));
    }

    query.get("code").map(|code| {
        Ending::Came(Returned {
            code: code.clone(),
            state: state.clone(),
        })
    })
}

pub fn refusal(code: &str) -> String {
    match code {
        "access_denied" => "You did not allow the studio to use that account.".to_string(),
        other => format!("The service refused the sign-in ({other})."),
    }
}

impl Listening {
    pub async fn open() -> Result<Self, String> {
        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .map_err(|err| format!("The studio could not listen for the answer: {err}"))?;

        let port = listener
            .local_addr()
            .map_err(|err| format!("The studio could not listen for the answer: {err}"))?
            .port();

        Ok(Self { listener, port })
    }

    pub fn redirect(&self) -> String {
        format!("http://127.0.0.1:{}/callback", self.port)
    }

    pub async fn wait(&self, expected_state: &str, patience: Duration) -> Ending {
        match timeout(patience, self.answered(expected_state)).await {
            Ok(ending) => ending,
            Err(_) => Ending::Waited,
        }
    }

    async fn answered(&self, expected_state: &str) -> Ending {
        loop {
            let Ok((stream, _)) = self.listener.accept().await else {
                continue;
            };

            if let Some(ending) = served(stream, expected_state).await {
                return ending;
            }
        }
    }
}

async fn served(mut stream: TcpStream, expected_state: &str) -> Option<Ending> {
    let mut buffer = [0_u8; 4096];
    let read = stream.read(&mut buffer).await.ok()?;
    let request = String::from_utf8_lossy(&buffer[..read]).into_owned();

    let ending = read_target(&request).and_then(|target| ending_of(target, expected_state));

    let body = match &ending {
        Some(Ending::Came(_)) | None => PAGE,
        Some(Ending::Refused(reason)) => reason.as_str(),
        Some(Ending::Waited) => PAGE,
    };

    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
    let _ = stream.write_all(response.as_bytes()).await;
    let _ = stream.shutdown().await;

    ending
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_query_is_read_into_its_pairs() {
        let query = query_of("/callback?code=abc&state=xyz");

        assert_eq!(query.get("code"), Some(&"abc".to_string()));
        assert_eq!(query.get("state"), Some(&"xyz".to_string()));
    }

    #[test]
    fn an_escaped_value_comes_back_whole() {
        let query = query_of("/callback?code=a%2Fb%2Bc&state=x%20y");

        assert_eq!(query.get("code"), Some(&"a/b+c".to_string()));
        assert_eq!(query.get("state"), Some(&"x y".to_string()));
    }

    #[test]
    fn the_target_is_taken_from_the_request_line() {
        let request = "GET /callback?code=abc&state=xyz HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n";

        assert_eq!(read_target(request), Some("/callback?code=abc&state=xyz"));
    }

    #[test]
    fn an_answer_carrying_the_expected_state_is_taken() {
        let ending = ending_of("/callback?code=abc&state=xyz", "xyz");

        assert_eq!(
            ending,
            Some(Ending::Came(Returned {
                code: "abc".to_string(),
                state: "xyz".to_string(),
            }))
        );
    }

    #[test]
    fn an_answer_from_another_attempt_is_not_taken() {
        let ending = ending_of("/callback?code=abc&state=someone-elses", "xyz");

        assert_eq!(ending, None);
    }

    #[test]
    fn an_answer_with_no_state_is_not_taken() {
        assert_eq!(ending_of("/callback?code=abc", "xyz"), None);
        assert_eq!(ending_of("/favicon.ico", "xyz"), None);
    }

    #[test]
    fn a_refusal_is_worded_rather_than_shown_as_a_code() {
        let ending = ending_of("/callback?error=access_denied&state=xyz", "xyz");

        assert_eq!(
            ending,
            Some(Ending::Refused(
                "You did not allow the studio to use that account.".to_string()
            ))
        );
        assert!(refusal("server_error").contains("server_error"));
    }

    #[tokio::test]
    async fn a_listener_names_a_loopback_address_of_its_own() {
        let listening = Listening::open().await.expect("a port is free");

        assert!(listening.redirect().starts_with("http://127.0.0.1:"));
        assert!(listening.port > 0);
    }

    #[tokio::test]
    async fn an_answer_that_arrives_is_taken() {
        let listening = Listening::open().await.expect("a port is free");
        let redirect = listening.redirect();

        let knocking = tokio::spawn(async move {
            reqwest::get(format!("{redirect}?code=abc&state=xyz"))
                .await
                .map(|answer| answer.status().as_u16())
        });

        let ending = listening.wait("xyz", Duration::from_secs(5)).await;
        let knocked = knocking.await.expect("the request finishes");

        assert_eq!(
            ending,
            Ending::Came(Returned {
                code: "abc".to_string(),
                state: "xyz".to_string(),
            })
        );
        assert_eq!(knocked.expect("the browser is answered"), 200);
    }

    #[tokio::test]
    async fn an_answer_from_another_attempt_leaves_this_one_waiting() {
        let listening = Listening::open().await.expect("a port is free");
        let redirect = listening.redirect();

        tokio::spawn(async move {
            let _ = reqwest::get(format!("{redirect}?code=abc&state=someone-elses")).await;
        });

        let ending = listening.wait("xyz", Duration::from_millis(400)).await;

        assert_eq!(ending, Ending::Waited);
    }

    #[tokio::test]
    async fn a_trip_nobody_finishes_ends_as_waited() {
        let listening = Listening::open().await.expect("a port is free");
        let ending = listening.wait("xyz", Duration::from_millis(100)).await;

        assert_eq!(ending, Ending::Waited);
    }

    #[tokio::test]
    async fn a_refusal_that_arrives_is_worded() {
        let listening = Listening::open().await.expect("a port is free");
        let redirect = listening.redirect();

        tokio::spawn(async move {
            let _ = reqwest::get(format!("{redirect}?error=access_denied&state=xyz")).await;
        });

        let ending = listening.wait("xyz", Duration::from_secs(5)).await;

        assert_eq!(
            ending,
            Ending::Refused("You did not allow the studio to use that account.".to_string())
        );
    }
}
