package org.code.codelink.websocket;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.code.codelink.controller.RoomController;
import org.springframework.beans.factory.annotation.Value;
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

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

@Controller
@RequiredArgsConstructor
@Slf4j
public class RoomWebSocketController {

    private final StringRedisTemplate redis;
    private final SimpMessagingTemplate broker;

    @Value("${codelink.room.expiry-hours:24}")
    private long expiryHours;

    // Maps STOMP session ID → roomId so disconnect can decrement the right room
    private final ConcurrentHashMap<String, String> sessionRooms = new ConcurrentHashMap<>();

    // Maps roomId → live viewer count on this instance
    private final ConcurrentHashMap<String, AtomicInteger> viewerCounts = new ConcurrentHashMap<>();

    // ── Edit ─────────────────────────────────────────────────────────────────
    // Client publishes to /app/room/{roomId}/edit with body { "code": "..." }
    @MessageMapping("/room/{roomId}/edit")
    public void edit(
            @DestinationVariable String roomId,
            @Payload WsMessages.CodeEdit msg,
            SimpMessageHeaderAccessor headers) {

        String key = RoomController.codeKey(roomId);

        // Ignore edits for rooms that have already expired
        if (Boolean.FALSE.equals(redis.hasKey(key))) {
            log.warn("Edit received for expired/unknown room: {}", roomId);
            return;
        }

        // Write latest content + refresh TTL
        redis.opsForValue().set(key, msg.getCode() != null ? msg.getCode() : "", expiryHours, TimeUnit.HOURS);

        // Track session → room on first edit (lazy registration fallback)
        String sessionId = headers.getSessionId();
        if (sessionId != null) {
            sessionRooms.putIfAbsent(sessionId, roomId);
        }

        int viewers = viewerCount(roomId);
        broker.convertAndSend(
                "/topic/room/" + roomId,
                new WsMessages.CodeBroadcast(msg.getCode() != null ? msg.getCode() : "", viewers)
        );
    }

    // ── Connect ───────────────────────────────────────────────────────────────
    // We learn which room the session belongs to on the first edit (above) or
    // by reading the STOMP connect headers if the client sends a roomId header.
    // Either way, viewer count is tracked here for the "N people viewing" badge.
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
        int count = (counter != null) ? Math.max(0, counter.decrementAndGet()) : 0;
        if (counter != null && count == 0) viewerCounts.remove(roomId);

        broker.convertAndSend("/topic/room/" + roomId, new WsMessages.ViewerCount(count));
        log.debug("DISCONNECT session={} room={} viewers={}", sessionId, roomId, count);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    private int viewerCount(String roomId) {
        AtomicInteger c = viewerCounts.get(roomId);
        return c != null ? c.get() : 0;
    }
}
