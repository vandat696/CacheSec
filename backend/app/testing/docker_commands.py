"""Bounded Docker CLI subprocesses; candidate output is never a test verdict."""

import subprocess
import threading
import time
from dataclasses import dataclass

OUTPUT_LIMIT = 1048576


class DockerFailure(Exception):
    def __init__(self, reason="EXECUTOR_ERROR"):
        self.reason = reason
        super().__init__(reason)


@dataclass
class BoundedProcess:
    process: subprocess.Popen
    stdout: bytearray
    stderr: bytearray
    overflow: threading.Event
    threads: tuple[threading.Thread, ...]

    @classmethod
    def start(cls, args: list[str], stdin: bytes | None = None):
        process = subprocess.Popen(
            ["docker", *args], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE
        )
        output, errors, overflow = bytearray(), bytearray(), threading.Event()

        def drain(stream, buffer):
            with stream:
                while chunk := stream.read(8192):
                    remaining = OUTPUT_LIMIT - len(buffer)
                    buffer.extend(chunk[:remaining])
                    if len(chunk) > remaining:
                        overflow.set()

        threads = tuple(
            threading.Thread(target=drain, args=pair, daemon=True)
            for pair in ((process.stdout, output), (process.stderr, errors))
        )
        for thread in threads:
            thread.start()
        if stdin:
            process.stdin.write(stdin)
        process.stdin.close()
        return cls(process, output, errors, overflow, threads)

    def wait(self, deadline: float, peers=()):
        try:
            while self.process.poll() is None:
                if self.overflow.is_set() or any(p.overflow.is_set() for p in peers):
                    raise DockerFailure("OUTPUT_LIMIT")
                if time.monotonic() >= deadline:
                    raise DockerFailure("TEST_DEADLINE")
                time.sleep(0.05)
            for thread in self.threads:
                thread.join(timeout=1)
            if self.overflow.is_set() or any(p.overflow.is_set() for p in peers):
                raise DockerFailure("OUTPUT_LIMIT")
            if self.process.returncode:
                raise DockerFailure()
            return bytes(self.stdout)
        finally:
            if self.process.poll() is None:
                self.process.kill()
                self.process.wait(timeout=5)


def docker(args: list[str], *, deadline: float | None = None, stdin: bytes | None = None):
    return BoundedProcess.start(args, stdin).wait(deadline or time.monotonic() + 20)
