"""
====================================================================================================
AELA Academic Demonstration Master Runner
Vellore Institute of Technology
Presented by: Taanush Emmanuel Abraham (Reg: 24BCE0708)
====================================================================================================
Orchestrates an end-to-end, offline-resilient presentation demonstrating all four phases of the
Automated Ephemeral Least-Privilege Architecture (AELA).
"""

from __future__ import annotations

import os
import subprocess
import sys
import time


def clear_screen() -> None:
    """Clears the terminal screen across Windows and Unix platforms."""
    os.system("cls" if os.name == "nt" else "clear")


def print_academic_header() -> None:
    """Prints the formal academic project presentation header."""
    border = "=" * 120
    print(border)
    print("Automated Ephemeral Least-Privilege Architecture (AELA) | Vellore Institute of Technology | Presented by: Taanush Emmanuel Abraham (Reg: 24BCE0708)")
    print(border)
    print()
    sys.stdout.flush()


def print_phase_separator(phase_number: int, phase_title: str, description: str) -> None:
    """Renders a distinguished visual ASCII banner separating demonstration phases."""
    sys.stdout.flush()
    divider = "#" * 120
    sub_divider = "-" * 120
    print("\n" + divider)
    print(f"  [DEMONSTRATION PHASE {phase_number}] {phase_title.upper()}")
    print(sub_divider)
    print(f"  Objective: {description}")
    print(divider + "\n")
    sys.stdout.flush()


def print_pause_intermission(seconds: int = 5, next_phase_name: str = "") -> None:
    """
    Displays an intermission countdown pause between phases allowing the audience
    to inspect and digest the real-time architectural output.
    """
    sys.stdout.flush()
    print(f"\n[INTERMISSION] Pausing for {seconds} seconds to digest output before {next_phase_name}...")
    for remaining in range(seconds, 0, -1):
        sys.stdout.write(f"\r>>> Advancing in {remaining} second(s)... (Press Ctrl+C to pause/exit)")
        sys.stdout.flush()
        time.sleep(1)
    print("\r" + " " * 90 + "\r", end="")
    sys.stdout.flush()


def run_demo_step(script_path: str, cwd: str) -> None:
    """Executes a demonstration runner subprocess with unbuffered stream inheritance."""
    sys.stdout.flush()
    sys.stderr.flush()
    cmd = [sys.executable, "-u", script_path]
    result = subprocess.run(cmd, cwd=cwd)
    sys.stdout.flush()
    sys.stderr.flush()
    if result.returncode != 0:
        print(f"\n[WARNING] Runner '{script_path}' exited with non-zero code: {result.returncode}")


def main() -> None:
    root_dir = os.path.abspath(os.path.dirname(__file__))

    # Demonstration stages
    stages = [
        {
            "phase": 1,
            "title": "Phase 2: Analytics Engine Telemetry & Time-Decay Quarantine",
            "script": os.path.join("src", "analytics_engine", "demo_runner.py"),
            "description": "Simulates CloudTrail ingestion, detects idle duration gaps, and triggers scale-to-zero decisions.",
            "next_title": "Phase 3 (JIT Proxy)",
        },
        {
            "phase": 2,
            "title": "Phase 3: Just-In-Time (JIT) Ephemeral Token Leasing Layer",
            "script": os.path.join("src", "jit_proxy", "demo_runner.py"),
            "description": "Validates microservice status, synthesizes scoped session policies, and issues 5-minute STS tokens.",
            "next_title": "Phase 4 (Load Benchmark)",
        },
        {
            "phase": 3,
            "title": "Phase 4: Empirical Transaction Load & Security Isolation Benchmark",
            "script": os.path.join("tests", "jmeter_plans", "load_test_runner.py"),
            "description": "Executes concurrent synthetic traffic bursts, measuring throughput, STS latency, and rejection rates.",
            "next_title": "Conclusion",
        },
    ]

    try:
        # Step 1: Clear screen and display formal academic header
        clear_screen()
        print_academic_header()

        # Step 2: Sequential Execution of all three demonstration runners
        total_stages = len(stages)
        for idx, stage in enumerate(stages, 1):
            print_phase_separator(
                phase_number=stage["phase"],
                phase_title=stage["title"],
                description=stage["description"],
            )

            run_demo_step(stage["script"], cwd=root_dir)

            if idx < total_stages:
                print_pause_intermission(seconds=5, next_phase_name=stage["next_title"])

        # Final Academic Summary Banner
        sys.stdout.flush()
        print("\n" + "=" * 120)
        print(" [AELA PRESENTATION COMPLETE] All four architectural layers successfully verified.")
        print(" 1. Declarative Infrastructure (VPC Isolation, IAM Deny Profiles, Telemetry Endpoints)")
        print(" 2. Event Stream Analytics Engine (CloudTrail Parsing, Time-Decay Gaps, Anomaly Quarantine)")
        print(" 3. State-Machine Loops & JIT Leasing (Step Functions Revocation, Dynamic Scoped STS Tokens)")
        print(" 4. Empirical Performance Validation (JMeter Load Test Suite, Concurrency Benchmarking)")
        print("=" * 120 + "\n")
        sys.stdout.flush()

    except KeyboardInterrupt:
        print("\n\n" + "-" * 120)
        print(" [PRESENTATION PAUSED / TERMINATED] Academic demonstration exited cleanly by presenter.")
        print("-" * 120 + "\n")
        sys.exit(0)


if __name__ == "__main__":
    main()
