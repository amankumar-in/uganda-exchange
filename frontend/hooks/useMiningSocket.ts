import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/context/AuthContext';
import { getWsUrl } from '@/services/api/config';

const WS_URL = getWsUrl();

interface UseMiningSocketOptions {
  onMiningUpdate?: (data: any) => void;
  onSessionCompleted?: (data: { tokenId: string; symbol: string; tokensEarned: number }) => void;
}

export function useMiningSocket(options: UseMiningSocketOptions = {}) {
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (!user?.id) return;

    const socket = io(`${WS_URL}/mining`, {
      transports: ['websocket'],
      withCredentials: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('subscribe_mining', { userId: user.id });
    });

    socket.on('mining_update', (data: any) => {
      optionsRef.current.onMiningUpdate?.(data);
    });

    socket.on('mining_session_completed', (data: any) => {
      optionsRef.current.onSessionCompleted?.(data);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user?.id]);

  return socketRef.current;
}
