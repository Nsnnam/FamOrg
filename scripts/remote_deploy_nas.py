#!/usr/bin/env python3
"""Deploy FamOrg to Synology: pipe install script over SSH (no SFTP).

Credentials via env (never hardcode):
  FAMORG_SSH_HOST   default namns.i234.me
  FAMORG_SSH_PORT   default 2232
  FAMORG_SSH_USER   required
  FAMORG_SSH_PASS   required
"""
from __future__ import annotations

import base64
import os
import shlex
import sys
import time

import paramiko

HOST = os.environ.get("FAMORG_SSH_HOST", "namns.i234.me")
PORT = int(os.environ.get("FAMORG_SSH_PORT", "2232"))
USER = os.environ.get("FAMORG_SSH_USER", "")
PASSWORD = os.environ.get("FAMORG_SSH_PASS", "")

REMOTE_SCRIPT = "/tmp/famorg_nas_install.sh"
LOCAL_SCRIPT = os.path.join(os.path.dirname(__file__), "nas_install.sh")


def stream_cmd(client: paramiko.SSHClient, cmd: str, timeout: int = 1800) -> int:
    print(f"$ {cmd[:120]}{'...' if len(cmd) > 120 else ''}")
    stdin, stdout, stderr = client.exec_command(cmd, get_pty=True, timeout=timeout)
    channel = stdout.channel
    while True:
        if channel.recv_ready():
            chunk = channel.recv(8192).decode("utf-8", errors="replace")
            if PASSWORD:
                chunk = chunk.replace(PASSWORD, "***")
            sys.stdout.write(chunk)
            sys.stdout.flush()
        if channel.recv_stderr_ready():
            chunk = channel.recv_stderr(8192).decode("utf-8", errors="replace")
            if PASSWORD:
                chunk = chunk.replace(PASSWORD, "***")
            sys.stderr.write(chunk)
            sys.stderr.flush()
        if channel.exit_status_ready() and not channel.recv_ready() and not channel.recv_stderr_ready():
            break
        time.sleep(0.1)
    code = channel.recv_exit_status()
    while channel.recv_ready():
        chunk = channel.recv(8192).decode("utf-8", errors="replace")
        if PASSWORD:
            chunk = chunk.replace(PASSWORD, "***")
        sys.stdout.write(chunk)
    print(f"\n[exit {code}]")
    return code


def main() -> int:
    if not USER or not PASSWORD:
        print(
            "Set FAMORG_SSH_USER and FAMORG_SSH_PASS (optional FAMORG_SSH_HOST/PORT).",
            file=sys.stderr,
        )
        return 2

    with open(LOCAL_SCRIPT, "rb") as f:
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
            f"echo {b64} | base64 -d > {REMOTE_SCRIPT} && chmod 755 {REMOTE_SCRIPT} && wc -c {REMOTE_SCRIPT}"
        )
        print("Uploading install script...")
        code = stream_cmd(client, write_cmd, timeout=60)
        if code != 0:
            return code

        pw = shlex.quote(PASSWORD)
        run_cmd = (
            "export PATH=/usr/local/bin:/usr/bin:/bin:/sbin; "
            f"echo {pw} | sudo -S -p '' bash {REMOTE_SCRIPT}"
        )
        print("Running install...")
        return stream_cmd(client, run_cmd, timeout=1800)
    finally:
        client.close()


if __name__ == "__main__":
    sys.exit(main())
