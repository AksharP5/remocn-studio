use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
    thread,
};

use time::{format_description::well_known::Rfc3339, OffsetDateTime};
use tokio::sync::mpsc::{unbounded_channel, UnboundedSender};

const FILE_NAME: &str = "sidecar.log";
const MAX_BYTES: u64 = 4 * 1024 * 1024;

pub struct SidecarLog {
    path: PathBuf,
    writer: UnboundedSender<String>,
}

impl SidecarLog {
    pub fn open(dir: &Path) -> Self {
        let _ = fs::create_dir_all(dir);
        let path = dir.join(FILE_NAME);
        rotate(&path);

        let (writer, mut lines) = unbounded_channel::<String>();
        let target = path.clone();

        thread::spawn(move || {
            let mut log = RotatingFile::open(target, MAX_BYTES);
            while let Some(line) = lines.blocking_recv() {
                log.write_line(&line);
            }
        });

        Self { path, writer }
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    pub fn host(&self, message: impl AsRef<str>) {
        self.append("host", message.as_ref());
    }

    pub fn sidecar(&self, message: impl AsRef<str>) {
        self.append("sidecar", message.as_ref());
    }

    fn append(&self, source: &str, message: &str) {
        let stamp = OffsetDateTime::now_utc()
            .format(&Rfc3339)
            .unwrap_or_default();
        let _ = self.writer.send(format!("{stamp} [{source}] {message}"));
    }
}

struct RotatingFile {
    file: Option<fs::File>,
    limit: u64,
    path: PathBuf,
    written: u64,
}

impl RotatingFile {
    fn open(path: PathBuf, limit: u64) -> Self {
        let file = append_to(&path);
        let written = fs::metadata(&path).map(|meta| meta.len()).unwrap_or(0);
        Self {
            file,
            limit,
            path,
            written,
        }
    }

    fn write_line(&mut self, line: &str) {
        if self.written > self.limit {
            self.file = None;
            let _ = fs::rename(&self.path, old_path(&self.path));
            self.file = append_to(&self.path);
            self.written = 0;
        }
        let Some(file) = self.file.as_mut() else {
            return;
        };
        if writeln!(file, "{line}").is_ok() {
            self.written += line.len() as u64 + 1;
        }
        let _ = file.flush();
    }
}

fn append_to(path: &Path) -> Option<fs::File> {
    fs::OpenOptions::new()
        .append(true)
        .create(true)
        .open(path)
        .ok()
}

fn old_path(path: &Path) -> PathBuf {
    path.with_extension("log.old")
}

fn rotate(path: &Path) {
    let Ok(meta) = fs::metadata(path) else {
        return;
    };
    if meta.len() > MAX_BYTES {
        let _ = fs::rename(path, old_path(path));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn scratch(name: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!(
            "sidecar-log-{name}-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&root).unwrap();
        root
    }

    #[test]
    fn a_log_that_outgrows_its_limit_while_running_is_rolled_aside() {
        let dir = scratch("rolls");
        let path = dir.join(FILE_NAME);
        let mut log = RotatingFile::open(path.clone(), 100);

        for index in 0..12 {
            log.write_line(&format!("line {index:02} of the running session"));
        }

        let current = fs::read_to_string(&path).unwrap();
        let old = fs::read_to_string(old_path(&path)).unwrap();

        assert!(current.len() as u64 <= 100 + 40);
        assert!(current.starts_with("line 08"));
        assert!(current.contains("line 11"));
        assert!(old.starts_with("line 04"));
        assert!(old.contains("line 07"));
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn a_log_under_its_limit_is_left_alone() {
        let dir = scratch("stays");
        let path = dir.join(FILE_NAME);
        let mut log = RotatingFile::open(path.clone(), 10_000);

        log.write_line("one");
        log.write_line("two");

        assert_eq!(fs::read_to_string(&path).unwrap(), "one\ntwo\n");
        assert!(!old_path(&path).exists());
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn the_size_already_on_disk_counts_towards_the_limit() {
        let dir = scratch("counts");
        let path = dir.join(FILE_NAME);
        fs::write(&path, "x".repeat(150)).unwrap();
        let mut log = RotatingFile::open(path.clone(), 100);

        log.write_line("after the restart");

        assert_eq!(fs::read_to_string(&path).unwrap(), "after the restart\n");
        assert_eq!(fs::read_to_string(old_path(&path)).unwrap().len(), 150);
        let _ = fs::remove_dir_all(dir);
    }
}
