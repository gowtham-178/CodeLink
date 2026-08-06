package org.code.codelink.websocket;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.code.codelink.controller.RoomController;
import org.code.codelink.repository.RoomRepository;
import org.springframework.context.event.EventListener;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Controller;
import org.springframework.web.socket.messaging.SessionConnectEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.time.Duration;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Controller
@RequiredArgsConstructor
@Slf4j
public class RoomWebSocketController {

    private final StringRedisTemplate redis;
    private final SimpMessagingTemplate broker;
    private final RoomRepository roomRepository;

    // STOMP session ID → roomId
    private final ConcurrentHashMap<String, String> sessionRooms = new ConcurrentHashMap<>();
    // roomId → live viewer count
    private final ConcurrentHashMap<String, AtomicInteger> viewerCounts = new ConcurrentHashMap<>();

    // ── Sync ───────────────────────────────────────────────────────────────────
    // New client requests current state after subscribing.
    // Broadcasts latest Redis code to the topic — senderSession is null so
    // the requester receives it; existing tabs ignore it if content unchanged.
    @MessageMapping("/room/{roomId}/sync")
    public void sync(@DestinationVariable String roomId) {
        String code = redis.opsForValue().get(RoomController.codeKey(roomId));
        if (code == null) {
            // Redis evicted the key — fall back to Postgres
            code = roomRepository.findByRoomId(roomId)
                    .map(r -> r.getContent() != null ? r.getContent() : "")
                    .orElse("");
            if (!code.isEmpty()) redis.opsForValue().set(RoomController.codeKey(roomId), code, Duration.ofHours(24));
        }
        broker.convertAndSend("/topic/room/" + roomId,
                new WsMessages.CodeBroadcast(code, viewerCount(roomId), null));
    }

    // ── Edit ──────────────────────────────────────────────────────────────────
    // Client → /app/room/{roomId}/edit  body: { "code": "..." }
    // Writes to Redis (live buffer) and broadcasts to all subscribers.
    // Postgres is written immediately for authenticated users, Redis-only for guests.
    @MessageMapping("/room/{roomId}/edit")
    public void edit(
            @DestinationVariable String roomId,
            @Payload WsMessages.CodeEdit msg,
            SimpMessageHeaderAccessor headers) {

        String code = msg.getCode() != null ? msg.getCode() : "";
        redis.opsForValue().set(RoomController.codeKey(roomId), code, Duration.ofHours(24));

        // Persist to Postgres asynchronously — don't block the real-time WS path
        CompletableFuture.runAsync(() ->
            roomRepository.findByRoomId(roomId).ifPresent(room -> {
                room.setContent(code);
                roomRepository.save(room);
            })
        );

        // Lazy-register session→room fallback
        String sessionId = headers.getSessionId();
        if (sessionId != null) sessionRooms.putIfAbsent(sessionId, roomId);

        broker.convertAndSend("/topic/room/" + roomId,
                new WsMessages.CodeBroadcast(code, viewerCount(roomId), msg.getSenderSession()));
    }

    // ── Connect ───────────────────────────────────────────────────────────────
    @EventListener
    public void onConnect(SessionConnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = accessor.getSessionId();
        String roomId = accessor.getFirstNativeHeader("roomId");

        if (sessionId != null && roomId != null && !roomId.isBlank()) {
            sessionRooms.put(sessionId, roomId);
            int count = viewerCounts
                    .computeIfAbsent(roomId, k -> new AtomicInteger(0))
                    .incrementAndGet();
            broker.convertAndSend("/topic/room/" + roomId, new WsMessages.ViewerCount(count));
            log.debug("CONNECT session={} room={} viewers={}", sessionId, roomId, count);
        }
    }

    // ── Disconnect ────────────────────────────────────────────────────────────
    @EventListener
    public void onDisconnect(SessionDisconnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = accessor.getSessionId();
        if (sessionId == null) return;

        String roomId = sessionRooms.remove(sessionId);
        if (roomId == null) return;

        AtomicInteger counter = viewerCounts.get(roomId);
        int count = counter != null ? Math.max(0, counter.decrementAndGet()) : 0;
        if (counter != null && count == 0) viewerCounts.remove(roomId);

        broker.convertAndSend("/topic/room/" + roomId, new WsMessages.ViewerCount(count));
        log.debug("DISCONNECT session={} room={} viewers={}", sessionId, roomId, count);
    }

    private int viewerCount(String roomId) {
        AtomicInteger c = viewerCounts.get(roomId);
        return c != null ? c.get() : 0;
    }
}
