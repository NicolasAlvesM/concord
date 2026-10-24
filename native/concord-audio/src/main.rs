//! Helper do Concord: captura o áudio de um processo para o compartilhamento
//! de tela e escreve PCM float32 48 kHz estéreo intercalado em stdout.
//! Escreve "ready" em stderr quando a captura começa; erros também em stderr.

mod args;
#[cfg(windows)]
mod capture;

use std::process::ExitCode;

fn main() -> ExitCode {
    let argv: Vec<String> = std::env::args().skip(1).collect();
    let mode = match args::parse_args(&argv) {
        Ok(mode) => mode,
        Err(message) => {
            eprintln!("{message}");
            return ExitCode::from(2);
        }
    };
    run(&mode)
}

#[cfg(windows)]
fn run(mode: &args::Mode) -> ExitCode {
    match capture::run(mode) {
        Ok(()) => ExitCode::SUCCESS,
        Err(err) => {
            eprintln!("erro: {err}");
            ExitCode::FAILURE
        }
    }
}

#[cfg(not(windows))]
fn run(_mode: &args::Mode) -> ExitCode {
    eprintln!("erro: captura por processo só existe no Windows");
    ExitCode::FAILURE
}
