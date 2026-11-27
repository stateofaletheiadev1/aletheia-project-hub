# Monitoring and alerts

`deploy/monitor/` runs on every validator host: a systemd timer starts `aletheia_monitor.py` every
minute. It measures the host, the node and the public endpoints, compares with the previous run,
and emails when an alert starts, every six hours while it lasts, and when it clears. Without
mail settings every alert is still written to the journal (`journalctl -u aletheia-monitor`).

| Check | Alert when |
|---|---|
| Blocks | the finalized height has not risen for 2 minutes (not judged in the 15 minutes after the node starts, while it opens its store) |
| RPC | the node's RPC does not answer on the host (same grace) |
| Services | `aletheiad`, `aletheia-signer`, `aletheia-explorer` or `nginx` has no running process |
| Watchdog | the watchdog restarted a service (a notice) |
| Validator set | a validator joins or leaves (a notice) |
| Missed signatures | a validator missed over 20% of its parent-certificate signatures in the last ~1,200 blocks (protocol version 2) |
| Peers | the set has more than one validator and this node has no peers |
| Disk | the root disk is over 85% full |
| Memory | under 80 MB available and over 80% of swap used |
| Public endpoints | an HTTPS URL in `MONITOR_PUBLIC_URLS` does not answer |
| HTTPS certificates | one of those hosts' certificates expires within 14 days |

Python standard library only; nothing is installed on the host. The service runs as a dynamic,
unprivileged user with a read-only filesystem, reads the watchdog's journal through the
`systemd-journal` group, reads service state from the kernel's cgroups, and keeps its state in
`/var/lib/private/aletheia-monitor/state.json`.

## Install

```sh
cd deploy/monitor && sudo sh install.sh
sudo systemctl start aletheia-monitor.service && journalctl -u aletheia-monitor -n 20
```

## Mail

Create a dedicated app password for the sending mailbox (Zoho: accounts.zoho.com → Security →
App Passwords), never the mailbox's own password. Then, as root:

```sh
install -m 0600 deploy/monitor/monitor.env.example /etc/aletheia/monitor.env
editor /etc/aletheia/monitor.env      # MONITOR_SMTP_USER, MONITOR_SMTP_PASS, MONITOR_MAIL_TO
```

The next run picks the file up. Test it by stopping the explorer for two minutes
(`systemctl stop aletheia-explorer`, then start it): one "ALERT" and one "CLEARED" email arrive.

## Tests

`cd deploy/monitor && python3 -m unittest test_monitor.py`: stalls and the start-up grace,
services, disk, memory, endpoints and certificates, missed signatures, set changes, and the
start / reminder / clear sequence.
