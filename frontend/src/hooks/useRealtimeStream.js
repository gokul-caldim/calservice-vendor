/**
 * useRealtimeStream.js
 * Hardened SSE (Server-Sent Events) hook with Connection State Machine,
 * exponential backoff, silent token refresh on 401, strict single-instance management,
 * event deduplication, and REST reconciliation.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { getAccessToken, clearAuthTokens } from '../utils/authTokens.js';
import { apiRefreshToken } from '../api/client.js';

export const SSE_STATE = {
  DISCONNECTED: 'DISCONNECTED',
  CONNECTING: 'CONNECTING',
  CONNECTED: 'CONNECTED',
  RECONNECTING: 'RECONNECTING',
};

const BACKOFF_INITIAL_MS = 1000;
const BACKOFF_MAX_MS = 30000;
const DEDUP_HISTORY_MAX = 200;

export function useRealtimeStream({
  enabled = true,
  onEvent = null,
  onReconcile = null,
  onAuthFailure = null,
}) {
  const [connectionState, setConnectionState] = useState(SSE_STATE.DISCONNECTED);
  const eventSourceRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const backoffDelayRef = useRef(BACKOFF_INITIAL_MS);
  const retryCountRef = useRef(0);
  const processedEventsRef = useRef(new Set());
  const isRefreshingAuthRef = useRef(false);
  const wasReconnectingRef = useRef(false);
  const isMountedRef = useRef(true);

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

  const closeCurrentConnection = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (eventSourceRef.current) {
      try {
        eventSourceRef.current.close();
      } catch (_) {}
      eventSourceRef.current = null;
    }
  }, []);

  const connect = useCallback(async () => {
    if (!isMountedRef.current || !enabled) {
      setConnectionState(SSE_STATE.DISCONNECTED);
      return;
    }

    closeCurrentConnection();

    const token = getAccessToken();
    if (!token) {
      setConnectionState(SSE_STATE.DISCONNECTED);
      return;
    }

    setConnectionState((prev) => (prev === SSE_STATE.DISCONNECTED ? SSE_STATE.CONNECTING : SSE_STATE.RECONNECTING));

    try {
      const streamUrl = `/api/workforce/realtime/stream/?token=${encodeURIComponent(token)}`;
      const es = new EventSource(streamUrl);
      eventSourceRef.current = es;

      es.addEventListener('ping', () => {
        if (!isMountedRef.current) return;
        setConnectionState(SSE_STATE.CONNECTED);
        backoffDelayRef.current = BACKOFF_INITIAL_MS;
        retryCountRef.current = 0;

        if (wasReconnectingRef.current) {
          wasReconnectingRef.current = false;
          if (onReconcile) {
            onReconcile();
          }
        }
      });

      es.addEventListener('workforce_event', (e) => {
        if (!isMountedRef.current) return;
        setConnectionState(SSE_STATE.CONNECTED);
        backoffDelayRef.current = BACKOFF_INITIAL_MS;
        retryCountRef.current = 0;

        try {
          const eventData = JSON.parse(e.data);
          if (!isDuplicateEvent(eventData)) {
            if (onEvent) {
              onEvent(eventData);
            }
          }
        } catch (_) {}
      });

      es.onerror = async () => {
        if (!isMountedRef.current) return;
        closeCurrentConnection();

        // Check if authentication failed (or if refresh is needed)
        if (!isRefreshingAuthRef.current) {
          isRefreshingAuthRef.current = true;
          try {
            const newToken = await apiRefreshToken();
            isRefreshingAuthRef.current = false;

            if (newToken && isMountedRef.current && enabled) {
              // Successfully refreshed token -> reconnect immediately once
              wasReconnectingRef.current = true;
              connect();
              return;
            } else if (!newToken && !getAccessToken()) {
              // Refresh failed, authentication is dead -> stop reconnecting
              setConnectionState(SSE_STATE.DISCONNECTED);
              clearAuthTokens();
              if (onAuthFailure) onAuthFailure();
              return;
            }
          } catch (_) {
            isRefreshingAuthRef.current = false;
          }
        }

        // Network or server disconnect: apply exponential backoff with jitter
        wasReconnectingRef.current = true;
        setConnectionState(SSE_STATE.RECONNECTING);
        retryCountRef.current += 1;

        const jitter = Math.floor(Math.random() * 400) - 200;
        const delay = Math.min(BACKOFF_MAX_MS, backoffDelayRef.current) + jitter;
        backoffDelayRef.current = Math.min(BACKOFF_MAX_MS, backoffDelayRef.current * 2);

        reconnectTimerRef.current = setTimeout(() => {
          if (isMountedRef.current && enabled) {
            connect();
          }
        }, Math.max(500, delay));
      };
    } catch (_) {
      setConnectionState(SSE_STATE.DISCONNECTED);
    }
  }, [enabled, onEvent, onReconcile, onAuthFailure, isDuplicateEvent, closeCurrentConnection]);

  useEffect(() => {
    isMountedRef.current = true;
    if (enabled) {
      connect();
    } else {
      closeCurrentConnection();
      setConnectionState(SSE_STATE.DISCONNECTED);
    }

    return () => {
      isMountedRef.current = false;
      closeCurrentConnection();
    };
  }, [enabled, connect, closeCurrentConnection]);

  return {
    connectionState,
    reconnect: connect,
    disconnect: closeCurrentConnection,
  };
}
