/**
 * useRealtimeStream.js
 * Hardened SSE (Server-Sent Events) hook with:
 * 1. Generation-tracked connection lifecycle (immune to React rerenders and StrictMode replay)
 * 2. Callback refs to prevent function identity churn
 * 3. Client-side Circuit Breaker with exponential backoff (2s, 4s, 8s, 15s, 30s, 60s max)
 * 4. 15-second stability verification timer for circuit breaker reset
 * 5. Pre-connect JWT expiration detection and single-flight refresh
 * 6. Strict single-instance management and event deduplication
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { getAccessToken, clearAuthTokens, isTokenExpired } from '../utils/authTokens.js';
import { apiRefreshToken } from '../api/client.js';

export const SSE_STATE = {
  DISCONNECTED: 'DISCONNECTED',
  CONNECTING: 'CONNECTING',
  CONNECTED: 'CONNECTED',
  RECONNECTING: 'RECONNECTING',
};

const CIRCUIT_BREAKER_DELAYS = [2000, 4000, 8000, 15000, 30000, 60000];
const STABLE_CONNECTION_MS = 15000;
const DEDUP_HISTORY_MAX = 200;

function getBackoffDelay(failureCount) {
  const idx = Math.min(Math.max(0, failureCount - 1), CIRCUIT_BREAKER_DELAYS.length - 1);
  const base = CIRCUIT_BREAKER_DELAYS[idx];
  const jitter = Math.floor(Math.random() * 400) - 200;
  return Math.max(1000, base + jitter);
}

export function useRealtimeStream({
  enabled = true,
  onEvent = null,
  onReconcile = null,
  onAuthFailure = null,
}) {
  const [connectionState, setConnectionState] = useState(SSE_STATE.DISCONNECTED);

  // 1. Callback Refs (Prevents any function identity churn from affecting SSE lifecycle)
  const onEventRef = useRef(onEvent);
  const onReconcileRef = useRef(onReconcile);
  const onAuthFailureRef = useRef(onAuthFailure);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    onReconcileRef.current = onReconcile;
  }, [onReconcile]);

  useEffect(() => {
    onAuthFailureRef.current = onAuthFailure;
  }, [onAuthFailure]);

  // 2. Connection Lifecycle & Generation Tracking
  const connectionGenerationRef = useRef(0);
  const activeEventSourceRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const stableTimerRef = useRef(null);
  const failureCountRef = useRef(0);
  const processedEventsRef = useRef(new Set());
  const isRefreshingAuthRef = useRef(false);
  const wasReconnectingRef = useRef(false);
  const isMountedRef = useRef(true);
  const isConnectingRef = useRef(false);

  // Helper to deduplicate incoming events
  const isDuplicateEvent = useCallback((eventData) => {
    let key = null;
    if (eventData.id) {
      key = `id_${eventData.id}`;
    } else {
      const type = eventData.event_type || 'unknown';
      const time = eventData.timestamp || Date.now();
      const jobId = eventData.payload?.job_id || eventData.payload?.id || '';
      key = `sig_${type}_${jobId}_${time}`;
    }

    if (processedEventsRef.current.has(key)) {
      return true;
    }

    processedEventsRef.current.add(key);
    if (processedEventsRef.current.size > DEDUP_HISTORY_MAX) {
      const iterator = processedEventsRef.current.values();
      for (let i = 0; i < 50; i++) {
        const next = iterator.next();
        if (next.done) break;
        processedEventsRef.current.delete(next.value);
      }
    }
    return false;
  }, []);

  // 3. Generation-Aware Connection Cleanup
  const closeConnection = useCallback((expectedGeneration = null) => {
    if (expectedGeneration !== null && expectedGeneration !== connectionGenerationRef.current) {
      console.info(`[Realtime STALE] Skipping close for generation=${expectedGeneration}; active=${connectionGenerationRef.current}`);
      return;
    }

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (stableTimerRef.current) {
      clearTimeout(stableTimerRef.current);
      stableTimerRef.current = null;
    }
    if (activeEventSourceRef.current) {
      const gen = connectionGenerationRef.current;
      try {
        activeEventSourceRef.current.close();
        console.info(`[Realtime CLOSED] generation=${gen}`);
      } catch (_) {}
      activeEventSourceRef.current = null;
    }
  }, []);

  // 4. Stability Verifier for Circuit Breaker
  const markConnectionStable = useCallback((generation) => {
    if (stableTimerRef.current) {
      clearTimeout(stableTimerRef.current);
    }
    stableTimerRef.current = setTimeout(() => {
      if (isMountedRef.current && generation === connectionGenerationRef.current && activeEventSourceRef.current) {
        failureCountRef.current = 0;
        console.info(`[Realtime SSE] Connection stable (15s) for generation=${generation}. Circuit breaker reset.`);
      }
    }, STABLE_CONNECTION_MS);
  }, []);

  // 5. Authoritative Connect Implementation
  const connect = useCallback(async () => {
    if (!isMountedRef.current || !enabled) {
      setConnectionState(SSE_STATE.DISCONNECTED);
      return;
    }

    // Singleton guard: prevent duplicate concurrent connect executions
    if (isConnectingRef.current) {
      return;
    }
    if (activeEventSourceRef.current && activeEventSourceRef.current.readyState === EventSource.OPEN) {
      console.info('[Realtime SINGLETON] Active connection already exists; skipping duplicate connect.');
      return;
    }
    isConnectingRef.current = true;

    try {
      closeConnection();

      // Step A: Token Resolution & Expiry Validation
      let token = getAccessToken();
      if (!token) {
        setConnectionState(SSE_STATE.DISCONNECTED);
        isConnectingRef.current = false;
        return;
      }

      if (isTokenExpired(token)) {
        console.info('[Realtime TOKEN EXPIRED] Stored access token expired. Refreshing before connect...');
        if (!isRefreshingAuthRef.current) {
          isRefreshingAuthRef.current = true;
          try {
            const newToken = await apiRefreshToken();
            isRefreshingAuthRef.current = false;
            if (newToken) {
              console.info('[Realtime REFRESH SUCCESS] Token refreshed successfully.');
              token = newToken;
            } else {
              if (getAccessToken()) {
                // Refresh returned 503 (database busy) -> back off via circuit breaker
                failureCountRef.current += 1;
                const gen = connectionGenerationRef.current;
                const delay = getBackoffDelay(failureCountRef.current);
                console.warn(`[Realtime SSE] Token refresh hit 503 DB shortage (failure #${failureCountRef.current}). Retrying in ${delay}ms...`);
                reconnectTimerRef.current = setTimeout(() => {
                  if (isMountedRef.current && enabled) connect();
                }, delay);
                isConnectingRef.current = false;
                return;
              }

              console.warn('[Realtime SESSION EXPIRED] Refresh token rejected (401). Stopping realtime.');
              setConnectionState(SSE_STATE.DISCONNECTED);
              clearAuthTokens();
              isConnectingRef.current = false;
              if (onAuthFailureRef.current) onAuthFailureRef.current();
              return;
            }
          } catch (refErr) {
            isRefreshingAuthRef.current = false;
            if (getAccessToken()) {
              failureCountRef.current += 1;
              const delay = getBackoffDelay(failureCountRef.current);
              reconnectTimerRef.current = setTimeout(() => {
                if (isMountedRef.current && enabled) connect();
              }, delay);
              isConnectingRef.current = false;
              return;
            }
            console.warn('[Realtime SESSION EXPIRED] Error refreshing token:', refErr);
            setConnectionState(SSE_STATE.DISCONNECTED);
            clearAuthTokens();
            isConnectingRef.current = false;
            if (onAuthFailureRef.current) onAuthFailureRef.current();
            return;
          }
        }
      }

      if (!isMountedRef.current || !enabled) {
        setConnectionState(SSE_STATE.DISCONNECTED);
        isConnectingRef.current = false;
        return;
      }

      // Step B: Instantiate Generation-Tracked EventSource
      const currentGen = ++connectionGenerationRef.current;
      setConnectionState((prev) => (prev === SSE_STATE.DISCONNECTED ? SSE_STATE.CONNECTING : SSE_STATE.RECONNECTING));
      console.info(`[Realtime CONNECT] generation=${currentGen}`);

      const streamUrl = `/api/workforce/realtime/stream/?token=${encodeURIComponent(token)}`;
      const es = new EventSource(streamUrl);
      activeEventSourceRef.current = es;

      es.addEventListener('ping', () => {
        if (!isMountedRef.current || currentGen !== connectionGenerationRef.current) {
          console.info(`[Realtime STALE] Ignoring ping for generation=${currentGen}; active=${connectionGenerationRef.current}`);
          return;
        }
        setConnectionState(SSE_STATE.CONNECTED);
        markConnectionStable(currentGen);
        console.info(`[Realtime AUTH SUCCESS] generation=${currentGen}`);

        if (wasReconnectingRef.current) {
          wasReconnectingRef.current = false;
          if (onReconcileRef.current) {
            onReconcileRef.current();
          }
        }
      });

      es.addEventListener('workforce_event', (e) => {
        if (!isMountedRef.current || currentGen !== connectionGenerationRef.current) {
          return;
        }
        setConnectionState(SSE_STATE.CONNECTED);
        markConnectionStable(currentGen);

        try {
          const eventData = JSON.parse(e.data);
          if (!isDuplicateEvent(eventData)) {
            if (onEventRef.current) {
              onEventRef.current(eventData);
            }
          }
        } catch (_) {}
      });

      es.onerror = async () => {
        if (!isMountedRef.current || currentGen !== connectionGenerationRef.current) {
          console.info(`[Realtime STALE] Ignoring error for generation=${currentGen}; active=${connectionGenerationRef.current}`);
          return;
        }
        closeConnection(currentGen);

        wasReconnectingRef.current = true;
        setConnectionState(SSE_STATE.RECONNECTING);

        // Check if token is expired
        const currentTok = getAccessToken();
        const tokenExpired = isTokenExpired(currentTok);

        if (!tokenExpired && currentTok) {
          // Token is valid; failure is 503 (EMAXCONNSESSION) or transient network drop.
          // Increment circuit breaker failure count and back off.
          failureCountRef.current += 1;
          const delay = getBackoffDelay(failureCountRef.current);

          console.warn(`[Realtime RECONNECT] generation=${currentGen} (failure #${failureCountRef.current}) delay=${delay}ms`);
          reconnectTimerRef.current = setTimeout(() => {
            if (isMountedRef.current && enabled) {
              connect();
            }
          }, delay);
          return;
        }

        // Token is genuinely expired -> Single refresh attempt
        console.warn('[Realtime AUTH FAILURE] Stream token expired or missing. Refreshing...');
        if (!isRefreshingAuthRef.current) {
          isRefreshingAuthRef.current = true;
          try {
            const newToken = await apiRefreshToken();
            isRefreshingAuthRef.current = false;
            if (newToken) {
              console.info('[Realtime REFRESH SUCCESS] Token refreshed. Reconnecting with new token.');
              failureCountRef.current = 0;
              if (isMountedRef.current && enabled) {
                connect();
              }
              return;
            } else {
              // If tokens are still in storage, refresh failed due to 503/server error -> back off
              if (getAccessToken()) {
                failureCountRef.current += 1;
                const delay = getBackoffDelay(failureCountRef.current);
                console.warn(`[Realtime SSE] Token refresh hit 503 DB shortage. Retrying in ${delay}ms...`);
                reconnectTimerRef.current = setTimeout(() => {
                  if (isMountedRef.current && enabled) {
                    connect();
                  }
                }, delay);
                return;
              }

              console.warn('[Realtime SESSION EXPIRED] Refresh token expired or rejected (401). Stopping retries.');
              setConnectionState(SSE_STATE.DISCONNECTED);
              clearAuthTokens();
              if (onAuthFailureRef.current) onAuthFailureRef.current();
              return;
            }
          } catch (_) {
            isRefreshingAuthRef.current = false;
            if (getAccessToken()) {
              failureCountRef.current += 1;
              const delay = getBackoffDelay(failureCountRef.current);
              reconnectTimerRef.current = setTimeout(() => {
                if (isMountedRef.current && enabled) connect();
              }, delay);
              return;
            }
            console.warn('[Realtime SESSION EXPIRED] Exception during token refresh.');
            setConnectionState(SSE_STATE.DISCONNECTED);
            clearAuthTokens();
            if (onAuthFailureRef.current) onAuthFailureRef.current();
            return;
          }
        }
      };
    } catch (err) {
      console.warn('[Realtime AUTH FAILURE] Error creating EventSource stream:', err?.message || err);
      setConnectionState(SSE_STATE.DISCONNECTED);
    } finally {
      isConnectingRef.current = false;
    }
  }, [enabled, isDuplicateEvent, closeConnection, markConnectionStable]);

  // 6. Master Lifecycle Hook — Depends SOLELY on `enabled`
  useEffect(() => {
    isMountedRef.current = true;
    if (enabled) {
      connect();
    } else {
      closeConnection();
      setConnectionState(SSE_STATE.DISCONNECTED);
    }

    return () => {
      isMountedRef.current = false;
      closeConnection();
    };
  }, [enabled, connect, closeConnection]);

  return {
    connectionState,
    reconnect: connect,
    disconnect: closeConnection,
  };
}
