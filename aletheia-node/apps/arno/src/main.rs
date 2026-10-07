//! `arno`: the Arno compiler command (spec Section 26).
//!
//! ```text
//! arno check   <file.arno>                   report problems; write nothing
//! arno compile <file.arno> [-o <out.arnobc>] compile; default output beside the source
//! arno inspect <file.arnobc>                 verify a package and describe it
//! ```
//!
//! Exit status: 0 success, 1 the source has errors or the package is refused, 64 usage,
//! 66 input not readable, 73 output not writable.

use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::ExitCode;

use aletheia_arno::{SourceFile, check_source, compile};

const EXIT_ERRORS: u8 = 1;
const EXIT_USAGE: u8 = 64;
const EXIT_NO_INPUT: u8 = 66;
const EXIT_CANT_CREATE: u8 = 73;

const USAGE: &str = "usage:\n  arno check <file.arno>\n  arno compile <file.arno> [-o <out.arnobc>]\n  arno inspect <file.arnobc>\n";

fn out(text: &str) {
    let _ = std::io::stdout().lock().write_all(text.as_bytes());
}

fn err(text: &str) {
    let _ = std::io::stderr().lock().write_all(text.as_bytes());
}

fn read_source(path: &Path) -> Result<SourceFile, ExitCode> {
    let text = std::fs::read(path).map_err(|e| {
        err(&format!("arno: cannot read {}: {e}\n", path.display()));
        ExitCode::from(EXIT_NO_INPUT)
    })?;
    let text = String::from_utf8(text).map_err(|_| {
        err(&format!(
            "{}: error A1005: The file is not valid UTF-8 text.\n",
            path.display()
        ));
        ExitCode::from(EXIT_ERRORS)
    })?;
    let name = path.file_name().map_or_else(
        || path.display().to_string(),
        |n| n.to_string_lossy().into_owned(),
    );
    Ok(SourceFile::new(name, text))
}

fn report(file: &SourceFile, diagnostics: &[aletheia_arno::Diagnostic]) {
    let mut text = String::new();
    for diagnostic in diagnostics {
        text.push_str(&diagnostic.render(file));
        text.push('\n');
    }
    err(&text);
}

fn check(path: &Path) -> ExitCode {
    let file = match read_source(path) {
        Ok(file) => file,
        Err(code) => return code,
    };
    let (program, diagnostics) = check_source(&file);
    report(&file, &diagnostics);
    if program.is_some() {
        out(&format!("{}: no problems found\n", file.name()));
        ExitCode::SUCCESS
    } else {
        ExitCode::from(EXIT_ERRORS)
    }
}

fn compile_file(path: &Path, output: Option<PathBuf>) -> ExitCode {
    let file = match read_source(path) {
        Ok(file) => file,
        Err(code) => return code,
    };
    let bytes = match compile(&file) {
        Ok(bytes) => bytes,
        Err(diagnostics) => {
            report(&file, &diagnostics);
            return ExitCode::from(EXIT_ERRORS);
        }
    };
    let output = output.unwrap_or_else(|| path.with_extension("arnobc"));
    if let Err(e) = std::fs::write(&output, &bytes) {
        err(&format!("arno: cannot write {}: {e}\n", output.display()));
        return ExitCode::from(EXIT_CANT_CREATE);
    }
    let hash = aletheia_vm::Package::from_bytes(&bytes)
        .map(|p| p.code_hash().to_string())
        .unwrap_or_default();
    out(&format!(
        "{} -> {} ({} bytes, code hash {hash})\n",
        file.name(),
        output.display(),
        bytes.len()
    ));
    ExitCode::SUCCESS
}

fn inspect(path: &Path) -> ExitCode {
    let bytes = match std::fs::read(path) {
        Ok(bytes) => bytes,
        Err(e) => {
            err(&format!("arno: cannot read {}: {e}\n", path.display()));
            return ExitCode::from(EXIT_NO_INPUT);
        }
    };
    let package = match aletheia_vm::verify_bytes(&bytes) {
        Ok(package) => package,
        Err(e) => {
            err(&format!("{}: refused: {e}\n", path.display()));
            return ExitCode::from(EXIT_ERRORS);
        }
    };
    let name = |index: u16| package.text(index).unwrap_or("?").to_owned();
    let mut text = format!(
        "contract   {}\narno       {}.{}\ncompiler   {}\ncode hash  {}\nsource     {}\ncode       {} bytes\n",
        name(package.name),
        package.arno_version >> 8,
        package.arno_version & 0xff,
        package.compiler,
        package.code_hash(),
        package.source_hash,
        package.code.len(),
    );
    text.push_str("routines\n");
    for f in &package.functions {
        let mut tags = Vec::new();
        for (flag, word) in [
            (aletheia_vm::package::FLAG_CONSTRUCTOR, "constructor"),
            (aletheia_vm::package::FLAG_ENTRY, "entry"),
            (aletheia_vm::package::FLAG_VIEW, "view"),
            (aletheia_vm::package::FLAG_REENTRANT, "reentrant"),
        ] {
            if f.flags & flag != 0 {
                tags.push(word);
            }
        }
        text.push_str(&format!(
            "  {:<20} {} parameters, {} registers, {} instructions {}\n",
            name(f.name),
            f.params,
            f.registers.len(),
            f.code_len / 4,
            tags.join(" ")
        ));
    }
    text.push_str("storage\n");
    for slot in &package.storage {
        text.push_str(&format!("  {}\n", name(slot.name)));
    }
    text.push_str("errors\n");
    for error in &package.errors {
        text.push_str(&format!(
            "  {:<20} {}\n",
            name(error.name),
            name(error.message)
        ));
    }
    text.push_str("events\n");
    for event in &package.events {
        let fields: Vec<String> = event.fields.iter().map(|(n, _)| name(*n)).collect();
        text.push_str(&format!("  {}({})\n", name(event.name), fields.join(", ")));
    }
    out(&text);
    ExitCode::SUCCESS
}

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    match args
        .iter()
        .map(String::as_str)
        .collect::<Vec<_>>()
        .as_slice()
    {
        ["check", path] => check(Path::new(path)),
        ["compile", path] => compile_file(Path::new(path), None),
        ["compile", path, "-o", output] => {
            compile_file(Path::new(path), Some(PathBuf::from(output)))
        }
        ["inspect", path] => inspect(Path::new(path)),
        ["--version"] => {
            out(&format!("{}\n", aletheia_arno::COMPILER_ID));
            ExitCode::SUCCESS
        }
        _ => {
            err(USAGE);
            ExitCode::from(EXIT_USAGE)
        }
    }
}
