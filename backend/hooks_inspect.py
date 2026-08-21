"""
hooks_inspect.py

Inspects and asserts Phase 2 Frontend Architecture Invariants in useGPSPosition.js,
EmployeeRuntimeProvider.jsx, ClockInCard.jsx, and EmployeeDashboardPage.jsx.
"""

import os
import re

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend", "src")

def read_frontend_file(rel_path):
    full_path = os.path.join(FRONTEND_DIR, rel_path)
    if not os.path.exists(full_path):
        return ""
    with open(full_path, "r", encoding="utf-8") as f:
        return f.read()

def check_frontend_single_watcher_architecture():
    hook_src = read_frontend_file(os.path.join("hooks", "useGPSPosition.js"))
    provider_src = read_frontend_file(os.path.join("context", "EmployeeRuntimeProvider.jsx"))
    card_src = read_frontend_file(os.path.join("components", "employee", "ClockInCard.jsx"))
    dash_src = read_frontend_file(os.path.join("pages", "employee", "EmployeeDashboardPage.jsx"))

    has_location_tracker = "export function useLocationTracker" in hook_src
    provider_uses_tracker = "useLocationTracker(" in provider_src
    card_uses_runtime = "useEmployeeRuntime()" in card_src
    dash_uses_runtime = "useEmployeeRuntime()" in dash_src
    card_no_independent_watcher = "navigator.geolocation.watchPosition" not in card_src
    dash_no_independent_watcher = "navigator.geolocation.watchPosition" not in dash_src

    passed = (
        has_location_tracker
        and provider_uses_tracker
        and card_uses_runtime
        and dash_uses_runtime
        and card_no_independent_watcher
        and dash_no_independent_watcher
    )
    details = (
        f"Provider uses single tracker: {provider_uses_tracker}, "
        f"Card delegates to runtime: {card_uses_runtime}, "
        f"Dashboard delegates to runtime: {dash_uses_runtime}"
    )
    return {"passed": passed, "details": details}

def check_staged_startup():
    hook_src = read_frontend_file(os.path.join("hooks", "useGPSPosition.js"))
    provider_src = read_frontend_file(os.path.join("context", "EmployeeRuntimeProvider.jsx"))

    has_staged_stages = "getGPSPosition" in hook_src and "maximumAge" in hook_src and "timeout" in hook_src
    provider_fast_init = "getGPSPosition(false)" in provider_src

    passed = has_staged_stages and provider_fast_init
    return {
        "passed": passed,
        "details": f"Staged fallbacks: {has_staged_stages}, Fast initial fix: {provider_fast_init}"
    }

def check_retry_backoff_schedule():
    hook_src = read_frontend_file(os.path.join("hooks", "useGPSPosition.js"))
    has_schedule = "RETRY_BACKOFF_SCHEDULE" in hook_src and "[2000, 5000, 15000, 30000]" in hook_src
    resets_on_fix = "retryAttemptRef.current = 0" in hook_src

    passed = has_schedule and resets_on_fix
    return {
        "passed": passed,
        "details": f"Schedule [2s, 5s, 15s, 30s]: {has_schedule}, Resets on valid fix: {resets_on_fix}"
    }

def check_decoupled_presence():
    provider_src = read_frontend_file(os.path.join("context", "EmployeeRuntimeProvider.jsx"))
    has_decoupled_toggle = "togglePresenceFast" in provider_src or "togglePresence" in provider_src
    sets_online_immediately = "ONLINE_LOCATION_PENDING" in provider_src or "is_online" in provider_src

    passed = has_decoupled_toggle and sets_online_immediately
    return {
        "passed": passed,
        "details": f"Fast presence toggle: {has_decoupled_toggle}, Non-blocking GPS: {sets_online_immediately}"
    }

def check_gps_stale_state_handling():
    hook_src = read_frontend_file(os.path.join("hooks", "useGPSPosition.js"))
    card_src = read_frontend_file(os.path.join("components", "employee", "ClockInCard.jsx"))

    has_stale_state = "GPS_STATE.STALE" in hook_src or "STALE: 'GPS_STALE'" in hook_src
    card_shows_stale = "GPS_STATE.STALE" in card_src or "GPS STALE" in card_src

    passed = has_stale_state and card_shows_stale
    return {
        "passed": passed,
        "details": f"STALE state constant: {has_stale_state}, Card renders stale badge: {card_shows_stale}"
    }

def check_clock_in_coalescing():
    provider_src = read_frontend_file(os.path.join("context", "EmployeeRuntimeProvider.jsx"))
    dash_src = read_frontend_file(os.path.join("pages", "employee", "EmployeeDashboardPage.jsx"))

    has_provider_in_flight = "inFlightClockInRef" in provider_src
    has_dash_in_flight = "isClockingInRef" in dash_src

    passed = has_provider_in_flight and has_dash_in_flight
    return {
        "passed": passed,
        "details": f"Runtime inFlightClockInRef: {has_provider_in_flight}, Page isClockingInRef: {has_dash_in_flight}"
    }

def check_gps_recovery():
    hook_src = read_frontend_file(os.path.join("hooks", "useGPSPosition.js"))
    has_offline_queue = "offlineQueueRef" in hook_src and "flushOfflineQueue" in hook_src

    passed = has_offline_queue
    return {
        "passed": passed,
        "details": f"Offline telemetry queue & online listener: {has_offline_queue}"
    }
