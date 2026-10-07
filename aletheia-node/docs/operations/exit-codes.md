# aletheiad exit codes

| Status | Name | Meaning | What to do |
| --- | --- | --- | --- |
| 0 | clean stop | Stopped on SIGTERM or SIGINT after draining the chain thread and writing a WAL checkpoint at the finalized tip. | Nothing. |
| 64 | usage | Wrong command line. The expected form is printed. | Fix the unit file or command. |
| 70 | fail-stop (`EX_SOFTWARE`) | An invariant, storage, WAL or finality error. The node stopped rather than continue from state it cannot vouch for (spec Section 46.3). The log line names the error code. | Let systemd restart it: recovery (Section 24.3) runs at start-up. Three fail-stops within 10 minutes keep it down and page; see `recovery.md`. |
| 75 | clean halt (`EX_TEMPFAIL`) | The next height runs a protocol version this binary does not support (Section 44.4, C5). Nothing was executed past the last finalized height. | Install a release that supports the version named in the log and start again; it continues from the same height. systemd must not restart in a loop: `RestartPreventExitStatus=75`. The steward treats 75 as "switch binary now". |
| 78 | configuration (`EX_CONFIG`) | The configuration or genesis file was refused: unknown key, malformed value, wrong network for a plaintext key, producer requested outside devnet/regtest. The log line says which. | Fix the file named in the log. |
