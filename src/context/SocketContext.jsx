import {
  createSocket,
  updateSocketAuthToken,
} from "@/socket/socketClient";
import {
  BACKGROUND_SOCKET_PAUSE_MS,
  shouldPauseSocketForBackground,
} from "@/socket/realtimeRecoveryPolicy";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/stores";

const SocketContext = createContext(null);

const browserIsOnline = () =>
  typeof navigator === "undefined" || navigator.onLine !== false;

export function SocketProvider({ children }) {
  const { user } = useAuthStore();
  const socketRef = useRef(null);
  const connectedOnceRef = useRef(false);
  const pausedForOfflineRef = useRef(false);
  const pausedForBackgroundRef = useRef(false);
  const backgroundTimerRef = useRef(null);
  const disconnectReasonRef = useRef(null);
  const requestedRecoveryReasonRef = useRef(null);

  // Keep socket in state so children re-subscribe when instance is ready.
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState("idle");
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [recoveryEpoch, setRecoveryEpoch] = useState(0);
  const [lastConnectedAt, setLastConnectedAt] = useState(0);
  const [lastRecoveryReason, setLastRecoveryReason] = useState(null);

  useEffect(() => {
    const idToken = localStorage.getItem("idToken");

    connectedOnceRef.current = false;
    pausedForOfflineRef.current = false;
    pausedForBackgroundRef.current = false;
    disconnectReasonRef.current = null;
    requestedRecoveryReasonRef.current = null;
    setRecoveryEpoch(0);
    setReconnectAttempts(0);
    setLastRecoveryReason(null);

    if (!idToken || !user?.uid) {
      setConnectionState("idle");
      return undefined;
    }

    let disposed = false;

    const clearBackgroundTimer = () => {
      if (backgroundTimerRef.current) {
        clearTimeout(backgroundTimerRef.current);
        backgroundTimerRef.current = null;
      }
    };

    const client = createSocket(idToken, {
      onConnect: () => {
        if (disposed) return;

        const recovered = connectedOnceRef.current;
        const recoveryReason =
          requestedRecoveryReasonRef.current ||
          disconnectReasonRef.current ||
          "socket-reconnect";

        connectedOnceRef.current = true;
        pausedForOfflineRef.current = false;
        pausedForBackgroundRef.current = false;
        disconnectReasonRef.current = null;
        requestedRecoveryReasonRef.current = null;

        setIsConnected(true);
        setConnectionState("connected");
        setReconnectAttempts(0);
        setLastConnectedAt(Date.now());

        // The first successful connection is normal boot. Every later connect
        // means realtime events may have been missed and consumers should sync.
        if (recovered) {
          setLastRecoveryReason(recoveryReason);
          setRecoveryEpoch((value) => value + 1);
        }
      },
      onDisconnect: (reason) => {
        if (disposed) return;
        disconnectReasonRef.current = reason || "socket-disconnect";
        setIsConnected(false);

        if (!browserIsOnline()) {
          setConnectionState("offline");
        } else if (pausedForBackgroundRef.current) {
          setConnectionState("paused");
        } else {
          setConnectionState("disconnected");
        }
      },
      onError: () => {
        if (disposed) return;
        setIsConnected(false);
        setConnectionState(browserIsOnline() ? "reconnecting" : "offline");
      },
      onReconnectAttempt: (attempt) => {
        if (disposed) return;
        setReconnectAttempts(Number(attempt) || 1);
        setConnectionState(browserIsOnline() ? "reconnecting" : "offline");
      },
    });

    if (!client) {
      setConnectionState("idle");
      return undefined;
    }

    socketRef.current = client;
    setSocket(client);
    setConnectionState(client.connected ? "connected" : "connecting");

    const connectClient = (reason) => {
      if (disposed || !browserIsOnline()) return;
      updateSocketAuthToken(client);
      requestedRecoveryReasonRef.current = reason || "manual-reconnect";

      // Socket.IO already owns reconnects while active. Calling connect() only
      // after a deliberate pause/offline disconnect avoids duplicate loops.
      if (!client.connected && !client.active) {
        setConnectionState("connecting");
        client.connect();
      }
    };

    const onOffline = () => {
      clearBackgroundTimer();
      pausedForOfflineRef.current = true;
      setIsConnected(false);
      setConnectionState("offline");

      // Stop an infinite reconnect loop while the browser explicitly reports
      // no network. The online event will reconnect immediately later.
      if (client.connected || client.active) {
        client.disconnect();
      }
    };

    const onOnline = () => {
      pausedForOfflineRef.current = false;
      connectClient("online-resume");
    };

    const onVisibilityChange = () => {
      clearBackgroundTimer();

      if (document.visibilityState === "hidden") {
        const hiddenAt = Date.now();
        backgroundTimerRef.current = setTimeout(() => {
          backgroundTimerRef.current = null;
          if (disposed) return;

          const hiddenForMs = Date.now() - hiddenAt;
          if (
            shouldPauseSocketForBackground({
              visibilityState: document.visibilityState,
              hiddenForMs,
              online: browserIsOnline(),
              connected: client.connected,
            })
          ) {
            pausedForBackgroundRef.current = true;
            setConnectionState("paused");
            client.disconnect();
          }
        }, BACKGROUND_SOCKET_PAUSE_MS);
        return;
      }

      const wasPaused = pausedForBackgroundRef.current;
      pausedForBackgroundRef.current = false;
      updateSocketAuthToken(client);

      if (wasPaused || (!client.connected && !client.active)) {
        connectClient("foreground-resume");
      }
    };

    const onTokenRefreshed = () => {
      updateSocketAuthToken(client);
      if (
        browserIsOnline() &&
        document.visibilityState === "visible" &&
        !client.connected &&
        !client.active
      ) {
        connectClient("token-refresh");
      }
    };

    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    window.addEventListener("huy-locket-token-refreshed", onTokenRefreshed);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      disposed = true;
      clearBackgroundTimer();
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("huy-locket-token-refreshed", onTokenRefreshed);
      document.removeEventListener("visibilitychange", onVisibilityChange);

      client.disconnect();
      if (socketRef.current === client) socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
      setConnectionState("idle");
    };
  }, [user?.uid]);

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        connectionState,
        reconnectAttempts,
        recoveryEpoch,
        lastConnectedAt,
        lastRecoveryReason,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
