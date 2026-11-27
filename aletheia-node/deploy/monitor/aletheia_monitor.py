#!/usr/bin/env python3
"""AletheiaChain host monitor (docs/operations/monitoring.md).

Run every minute by aletheia-monitor.timer. Each run measures the host, the node and the public
endpoints, compares with the previous run (state in STATE_DIRECTORY), and sends email when an
alert starts, every six hours while it lasts, and when it clears. Without mail settings the
alerts go to the journal only.

Python standard library only, so nothing is installed on the host. The decisions are pure
functions (`evaluate`, `transitions`) so they are tested without a node (test_monitor.py).

Settings (environment, from /etc/aletheia/monitor.env, owner-only):
  MONITOR_SMTP_HOST (default smtp.zoho.com), MONITOR_SMTP_PORT (465), MONITOR_SMTP_USER,
  MONITOR_SMTP_PASS (a dedicated app password), MONITOR_MAIL_FROM (default the user),
  MONITOR_MAIL_TO (comma-separated), MONITOR_RPC (default http://127.0.0.1:7781),
  MONITOR_PUBLIC_URLS (comma-separated https URLs checked from outside the node).
"""

from __future__ import annotations

import json
import os
import shutil
import smtplib
import socket
import ssl
import subprocess
import sys
import time
import urllib.request
from dataclasses import dataclass, field
from email.message import EmailMessage
from pathlib import Path

# Thresholds, each with its reason.
STALL_SECONDS = 120  # two minutes without a new block: 240 missed 500 ms slots
MISSED_RATIO = 0.20  # a validator missing over a fifth of its signatures...
MISSED_WINDOW_BLOCKS = 1200  # ...over the last 1,200 blocks (about ten minutes)
DISK_PERCENT = 85.0
MEMORY_AVAILABLE_MB = 80
SWAP_USED_PERCENT = 80.0
TLS_DAYS = 14
REMIND_SECONDS = 6 * 3600
SERVICES = ("aletheiad", "aletheia-signer", "aletheia-explorer", "nginx")
# After a start the node opens its store for up to fifteen minutes (vps.md, watchdog).
NODE_GRACE_SECONDS = 15 * 60


@dataclass
class Reading:
    """What one run measured. Missing values are None (the check could not be made)."""

    now: float
    height: int | None = None
    peers: int | None = None
    services: dict[str, bool] = field(default_factory=dict)
    node_age_seconds: float | None = None
    watchdog_restarts: list[str] = field(default_factory=list)
    validators: list[dict] | None = None  # getValidatorSet "validators"
    disk_percent: float | None = None
    memory_available_mb: float | None = None
    swap_used_percent: float | None = None
    public: dict[str, bool] = field(default_factory=dict)
    tls_days: dict[str, float] = field(default_factory=dict)


def evaluate(reading: Reading, previous: dict) -> tuple[dict[str, str], dict, list[str]]:
    """Active alerts {key: message}, the state to keep, and one-off notices for this run."""
    alerts: dict[str, str] = {}
    notices: list[str] = []
    state = dict(previous)

    # Blocks: the height must rise. A node still opening its store is not judged.
    young = reading.node_age_seconds is not None and reading.node_age_seconds < NODE_GRACE_SECONDS
    if reading.height is None:
        if not young:
            alerts["rpc"] = "The node's RPC is not answering on the host."
    else:
        last_height = previous.get("height")
        since = previous.get("height_since", reading.now)
        if last_height is None or reading.height > last_height:
            state["height"] = reading.height
            state["height_since"] = reading.now
        elif reading.now - since >= STALL_SECONDS and not young:
            alerts["stalled"] = (
                f"No new block for {int(reading.now - since)} s; finalized height is still "
                f"{reading.height}."
            )

    for name, active in reading.services.items():
        if not active:
            alerts[f"service:{name}"] = f"The {name} service is not running."

    if reading.watchdog_restarts:
        notices.append("The watchdog restarted a service:\n  " + "\n  ".join(reading.watchdog_restarts))

    # Validators: membership changes, and each one's missed signatures over a window.
    if reading.validators is not None:
        keys = sorted(v.get("nodeKey", "") for v in reading.validators)
        if previous.get("validator_keys") not in (None, keys):
            joined = sorted(set(keys) - set(previous["validator_keys"]))
            left = sorted(set(previous["validator_keys"]) - set(keys))
            parts = [f"The validator set now has {len(keys)} members."]
            parts += [f"Joined: {k}" for k in joined]
            parts += [f"Left: {k}" for k in left]
            notices.append("\n  ".join(parts))
        state["validator_keys"] = keys
        windows = dict(previous.get("missed_windows", {}))
        for v in reading.validators:
            work = v.get("work") or {}
            key = v.get("nodeKey", "")
            if not work or reading.height is None:
                continue
            missed = int(work.get("missed", 0))
            start = windows.get(key)
            # A new period resets `missed`; a window starts again whenever it would go back.
            if start is None or missed < start["missed"] or reading.height - start["height"] > MISSED_WINDOW_BLOCKS:
                windows[key] = {"height": reading.height, "missed": missed}
                continue
            blocks = reading.height - start["height"]
            if blocks >= MISSED_WINDOW_BLOCKS // 4:
                ratio = (missed - start["missed"]) / blocks
                if ratio > MISSED_RATIO:
                    alerts[f"missing:{key}"] = (
                        f"Validator {v.get('index')} ({key[:16]}...) missed {missed - start['missed']} "
                        f"of the last {blocks} blocks ({ratio:.0%})."
                    )
        state["missed_windows"] = windows
        if len(keys) > 1 and reading.peers == 0:
            alerts["peers"] = f"{len(keys)} validators, but this node has no peers."

    if reading.disk_percent is not None and reading.disk_percent > DISK_PERCENT:
        alerts["disk"] = f"The root disk is {reading.disk_percent:.0f}% full."
    if (
        reading.memory_available_mb is not None
        and reading.swap_used_percent is not None
        and reading.memory_available_mb < MEMORY_AVAILABLE_MB
        and reading.swap_used_percent > SWAP_USED_PERCENT
    ):
        alerts["memory"] = (
            f"Only {reading.memory_available_mb:.0f} MB of memory available and "
            f"{reading.swap_used_percent:.0f}% of swap used."
        )
    for url, ok in reading.public.items():
        if not ok:
            alerts[f"public:{url}"] = f"{url} is not answering over HTTPS."
    for host, days in reading.tls_days.items():
        if days < TLS_DAYS:
            alerts[f"tls:{host}"] = f"The HTTPS certificate of {host} expires in {days:.0f} days."
    return alerts, state, notices


def transitions(alerts: dict[str, str], previous: dict, now: float) -> tuple[list[str], dict]:
    """Messages to send (started, still active after REMIND_SECONDS, cleared) and the new record."""
    known: dict = dict(previous.get("alerts", {}))
    messages: list[str] = []
    for key, text in alerts.items():
        entry = known.get(key)
        if entry is None:
            messages.append(f"ALERT: {text}")
            known[key] = {"since": now, "reminded": now, "text": text}
        elif now - entry["reminded"] >= REMIND_SECONDS:
            hours = (now - entry["since"]) / 3600
            messages.append(f"STILL ACTIVE ({hours:.0f} h): {text}")
            entry["reminded"] = now
            entry["text"] = text
    for key in [k for k in known if k not in alerts]:
        messages.append(f"CLEARED: {known[key]['text']}")
        del known[key]
    return messages, known


# ---------------------------------------------------------------- measuring the host


def http_json(url: str, timeout: float = 10.0) -> dict | None:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as response:
            return json.loads(response.read())
    except Exception:
        return None


def http_ok(url: str, timeout: float = 15.0) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as response:
            return 200 <= response.status < 400
    except Exception:
        return False


def tls_days_left(host: str, timeout: float = 10.0) -> float | None:
    try:
        context = ssl.create_default_context()
        with socket.create_connection((host, 443), timeout=timeout) as raw:
            with context.wrap_socket(raw, server_hostname=host) as tls:
                not_after = tls.getpeercert()["notAfter"]
        return (ssl.cert_time_to_seconds(not_after) - time.time()) / 86400
    except Exception:
        return None


def service_pids(name: str) -> list[int]:
    """Processes of a systemd service, from its cgroup: readable without reaching systemd, which
    the sandboxed monitor cannot (its filesystem is read-only, so no bus socket)."""
    try:
        text = Path(f"/sys/fs/cgroup/system.slice/{name}.service/cgroup.procs").read_text()
        return [int(pid) for pid in text.split()]
    except (OSError, ValueError):
        return []


def service_active(name: str) -> bool:
    return bool(service_pids(name))


def service_age(name: str) -> float | None:
    """Seconds since the service's oldest process started."""
    try:
        uptime = float(Path("/proc/uptime").read_text().split()[0])
        ticks = os.sysconf("SC_CLK_TCK")
        starts = []
        for pid in service_pids(name):
            stat = Path(f"/proc/{pid}/stat").read_text()
            # Field 22 (starttime), counted after the command name in parentheses.
            starts.append(int(stat.rsplit(")", 1)[1].split()[19]) / ticks)
        return uptime - min(starts) if starts else None
    except (OSError, ValueError, IndexError):
        return None


def watchdog_restarts(since: float) -> list[str]:
    out = subprocess.run(
        ["journalctl", "-u", "aletheia-watchdog", "--since", f"@{int(since)}", "--no-pager", "-o", "cat"],
        capture_output=True, text=True,
    ).stdout
    return [line for line in out.splitlines() if "restarting" in line]


def memory() -> tuple[float | None, float | None]:
    try:
        info = {}
        for line in Path("/proc/meminfo").read_text().splitlines():
            name, value = line.split(":", 1)
            info[name] = int(value.split()[0])
        available = info["MemAvailable"] / 1024
        swap_total = info.get("SwapTotal", 0)
        swap_used = 100.0 * (swap_total - info.get("SwapFree", 0)) / swap_total if swap_total else 0.0
        return available, swap_used
    except Exception:
        return None, None


def measure(previous: dict) -> Reading:
    now = time.time()
    rpc = os.environ.get("MONITOR_RPC", "http://127.0.0.1:7781").rstrip("/")
    reading = Reading(now=now)
    status = http_json(f"{rpc}/api/v1/network/status")
    if status:
        reading.height = status.get("finalizedHeight")
        reading.peers = status.get("peers")
    reading.services = {name: service_active(name) for name in SERVICES}
    reading.node_age_seconds = service_age("aletheiad")
    reading.watchdog_restarts = watchdog_restarts(previous.get("last_run", now - 60))
    validators = http_json(f"{rpc}/api/v1/validators")
    if validators and validators.get("mode") == "validator-set":
        reading.validators = validators.get("validators", [])
    usage = shutil.disk_usage("/")
    reading.disk_percent = 100.0 * usage.used / usage.total
    reading.memory_available_mb, reading.swap_used_percent = memory()
    for url in filter(None, os.environ.get("MONITOR_PUBLIC_URLS", "").split(",")):
        url = url.strip()
        reading.public[url] = http_ok(url)
        host = urllib.request.urlparse(url).hostname
        if host and host not in reading.tls_days:
            days = tls_days_left(host)
            if days is not None:
                reading.tls_days[host] = days
    return reading


def send(subject: str, body: str) -> bool:
    user = os.environ.get("MONITOR_SMTP_USER")
    password = os.environ.get("MONITOR_SMTP_PASS")
    recipients = [a.strip() for a in os.environ.get("MONITOR_MAIL_TO", "").split(",") if a.strip()]
    if not (user and password and recipients):
        return False
    message = EmailMessage()
    message["From"] = os.environ.get("MONITOR_MAIL_FROM", user)
    message["To"] = ", ".join(recipients)
    message["Subject"] = subject
    message.set_content(body)
    host = os.environ.get("MONITOR_SMTP_HOST", "smtp.zoho.com")
    port = int(os.environ.get("MONITOR_SMTP_PORT", "465"))
    try:
        with smtplib.SMTP_SSL(host, port, timeout=20, context=ssl.create_default_context()) as smtp:
            smtp.login(user, password)
            smtp.send_message(message)
        return True
    except Exception as error:
        print(f"monitor: could not send mail: {error}", file=sys.stderr)
        return False


def main() -> int:
    state_dir = Path(os.environ.get("STATE_DIRECTORY", "/var/lib/aletheia-monitor").split(":")[0])
    state_file = state_dir / "state.json"
    try:
        previous = json.loads(state_file.read_text())
    except Exception:
        previous = {}
    reading = measure(previous)
    alerts, state, notices = evaluate(reading, previous)
    messages, known = transitions(alerts, previous, reading.now)
    messages += [f"NOTICE: {n}" for n in notices]
    state["alerts"] = known
    state["last_run"] = reading.now
    host = socket.gethostname()
    for message in messages:
        print(f"monitor: {message}")
    if messages:
        first = messages[0].split(":", 1)[0]
        subject = f"[AletheiaChain {host}] {first}: {messages[0].split(':', 1)[1].strip()[:90]}"
        body = "\n\n".join(messages) + (
            f"\n\nHost: {host}\nFinalized height: {reading.height}\nPeers: {reading.peers}\n"
            f"Time (UTC): {time.strftime('%Y-%m-%d %H:%M:%S', time.gmtime(reading.now))}\n"
        )
        if not send(subject, body):
            print("monitor: mail is not configured or failed; the alert is in the journal only")
    tmp = state_file.with_suffix(".tmp")
    state_dir.mkdir(parents=True, exist_ok=True)
    tmp.write_text(json.dumps(state))
    tmp.replace(state_file)
    return 0


if __name__ == "__main__":
    sys.exit(main())
