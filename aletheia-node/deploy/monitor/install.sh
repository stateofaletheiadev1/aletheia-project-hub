#!/bin/sh
# Installs the monitor on a validator host (run as root from deploy/monitor/).
set -eu
install -d -m 0755 /usr/local/lib/aletheia-monitor
install -m 0644 aletheia_monitor.py /usr/local/lib/aletheia-monitor/aletheia_monitor.py
install -m 0644 aletheia-monitor.service aletheia-monitor.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now aletheia-monitor.timer
echo "installed; mail settings go in /etc/aletheia/monitor.env (see monitor.env.example)"
