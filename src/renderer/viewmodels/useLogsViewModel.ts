import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../services/api";
import type { LogEntry, LogLevel } from "../../shared/types";

const parseLogLine = (line: string): LogEntry | null => {
  const match = line.match(/^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\] \[(\w+)\] \[([^\]]+)\]\s*(.+)$/);
  if (!match) {
    return null;
  }

  const [, timestamp, level, scope, message] = match;
  const normalizedLevel = level.toLowerCase() as LogLevel;

  const timeMatch = timestamp.match(/\d{2}:\d{2}:\d{2}/);
  const displayTime = timeMatch ? timeMatch[0] : timestamp;

  return {
    id: `${timestamp}-${scope}-${Math.random().toString(36).slice(2, 9)}`,
    timestamp: displayTime,
    level: normalizedLevel,
    message: message.trim()
  };
};

export const useLogsViewModel = () => {
  const [logLines, setLogLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const atBottomRef = useRef(true);
  const scrollToEndRef = useRef<(() => void) | null>(null);

  const logs = useMemo<LogEntry[]>(() => {
    return logLines
      .map(parseLogLine)
      .filter((entry): entry is LogEntry => entry !== null);
  }, [logLines]);

  useEffect(() => {
    let isMounted = true;

    const loadLogs = async () => {
      setLoading(true);
      setError(null);
      try {
        const lines = await api.logs.read();
        if (isMounted) {
          setLogLines(lines);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load logs");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadLogs();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const setupSubscription = async () => {
      try {
        unsubscribe = api.logs.onNewLine((line: string) => {
          setLogLines((prev) => [...prev, line]);
          atBottomRef.current = true;
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to subscribe to logs");
      }
    };

    setupSubscription();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  useEffect(() => {
    if (atBottomRef.current) {
      scrollToEndRef.current?.();
    }
  }, [logs]);

  return {
    logs,
    loading,
    error,
    atBottomRef,
    scrollToEndRef
  };
};
