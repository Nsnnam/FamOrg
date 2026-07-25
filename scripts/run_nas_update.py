#!/usr/bin/env python3
"""Upload and run nas_update_now.sh on Synology via SSH sudo."""
from __future__ import annotations

import base64
import os
import shlex
import sys
import time

import paramiko

HOST = os.environ.get("FAMORG_SSH_HOST", "your-domain.example")
PORT = int(os.environ.get("FAMORG_SSH_PORT", "22"))
USER = os.environ.get("FAMORG_SSH_USER", "your-admin-user")
PASSWORD = os.environ.get("FAMORG_SSH_PASS", "")
REMOTE = "/tmp/famorg_update_now.sh"
LOCAL = os.path.join(os.path.dirname(__file__), "nas_update_now.sh")


def stream(client: paramiko.SSHClient, cmd: str, timeout: int = 1800) -> int:
    print(f"$ {cmd[:140]}{'...' if len(cmd) > 140 else ''}")
    stdin, stdout, stderr = client.exec_command(cmd, get_pty=True, timeout=timeout)
    ch = stdout.channel
    while True:
        if ch.recv_ready():
            chunk = ch.recv(8192).decode("utf-8", errors="replace")
            if PASSWORD:
                chunk = chunk.replace(PASSWORD, "***")
            sys.stdout.write(chunk)
            sys.stdout.flush()
        if ch.recv_stderr_ready():
            chunk = ch.recv_stderr(8192).decode("utf-8", errors="replace")
            if PASSWORD:
                chunk = chunk.replace(PASSWORD, "***")
            sys.stderr.write(chunk)
            sys.stderr.flush()
        if ch.exit_status_ready() and not ch.recv_ready() and not ch.recv_stderr_ready():
            break
        time.sleep(0.1)
    code = ch.recv_exit_status()
    while ch.recv_ready():
        chunk = ch.recv(8192).decode("utf-8", errors="replace")
        if PASSWORD:
            chunk = chunk.replace(PASSWORD, "***")
        sys.stdout.write(chunk)
    print(f"\n[exit {code}]")
    return code


def main() -> int:
    if not PASSWORD:
        print("Set FAMORG_SSH_PASS", file=sys.stderr)
        return 2
    with open(LOCAL, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("ascii")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting {USER}@{HOST}:{PORT} ...")
    client.connect(
        HOST,
        port=PORT,
        username=USER,
        password=PASSWORD,
        timeout=30,
        allow_agent=False,
        look_for_keys=False,
        banner_timeout=60,
    )
    print("Connected.")
    try:
        write_cmd = (
            "export PATH=/usr/local/bin:/usr/bin:/bin:/sbin; "
            f"echo {b64} | base64 -d > {REMOTE} && chmod 755 {REMOTE} && wc -c {REMOTE}"
        )
        if stream(client, write_cmd, timeout=60) != 0:
            return 1
        pw = shlex.quote(PASSWORD)
        run_cmd = (
            "export PATH=/usr/local/bin:/usr/bin:/bin:/sbin; "
            f"echo {pw} | sudo -S -p '' bash {REMOTE}"
        )
        return stream(client, run_cmd, timeout=1800)
    finally:
        client.close()


if __name__ == "__main__":
    sys.exit(main())
