# The processor count the server sizes its thread pools from.
# Written with Claude Code (Anthropic) assistance.

import importlib
import os

from spherex_api import config


def machine() -> int:
    """Processors this test process may use, the ceiling for every answer below."""
    try:
        return len(os.sched_getaffinity(0))
    except (AttributeError, OSError):
        return os.cpu_count() or 2


def test_a_container_limit_is_respected(tmp_path):
    # Control groups, version 2: 2.5 processors' worth of time rounds up to three threads.
    (tmp_path / "cpu.max").write_text("250000 100000\n")
    assert config.usable_cpus(str(tmp_path)) == min(machine(), 3)
    (tmp_path / "cpu.max").write_text("50000 100000\n")
    assert config.usable_cpus(str(tmp_path)) == 1


def test_no_limit_means_every_processor(tmp_path):
    (tmp_path / "cpu.max").write_text("max 100000\n")
    assert config.usable_cpus(str(tmp_path)) == machine()
    # No control group files at all, as on a development machine.
    assert config.usable_cpus(str(tmp_path / "missing")) == machine()


def test_the_older_layout_is_read_too(tmp_path):
    folder = tmp_path / "cpu"
    folder.mkdir()
    (folder / "cpu.cfs_quota_us").write_text("100000\n")
    (folder / "cpu.cfs_period_us").write_text("100000\n")
    assert config.usable_cpus(str(tmp_path)) == 1
    (folder / "cpu.cfs_quota_us").write_text("-1\n")
    assert config.usable_cpus(str(tmp_path)) == machine()


def test_nonsense_in_the_files_is_ignored(tmp_path):
    (tmp_path / "cpu.max").write_text("soon\n")
    assert config.usable_cpus(str(tmp_path)) == machine()


def test_a_count_stated_by_the_deploy_wins(monkeypatch):
    # Cloud Run does not show its limit to the container, so the deploy states it.
    try:
        monkeypatch.setenv("SPX_CPUS", "3")
        assert importlib.reload(config).CPUS == 3
        # Nonsense, or zero, falls back to what the container can see.
        monkeypatch.setenv("SPX_CPUS", "many")
        assert importlib.reload(config).CPUS == machine()
        monkeypatch.setenv("SPX_CPUS", "0")
        assert importlib.reload(config).CPUS == machine()
    finally:
        monkeypatch.delenv("SPX_CPUS", raising=False)
        importlib.reload(config)
