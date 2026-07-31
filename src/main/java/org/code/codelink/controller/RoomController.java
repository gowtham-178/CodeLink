package org.code.codelink.controller;

import lombok.RequiredArgsConstructor;
import org.code.codelink.dto.RoomResponse;
import org.code.codelink.exception.RoomNotFoundException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/api/rooms")
@RequiredArgsConstructor
public class RoomController {

    private final StringRedisTemplate redis;

    @Value("${codelink.room.expiry-hours:24}")
    private long expiryHours;

    // ── POST /api/rooms ──────────────────────────────────────────────────────
    // Generates a random room ID, seeds an empty Redis entry with TTL,
    // returns {roomId, code, expiresAt}.
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public RoomResponse createRoom() {
        String roomId = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        String codeKey = codeKey(roomId);

        redis.opsForValue().set(codeKey, "", expiryHours, TimeUnit.HOURS);

        return new RoomResponse(roomId, "", Instant.now().plus(Duration.ofHours(expiryHours)));
    }

    // ── GET /api/rooms/{roomId} ──────────────────────────────────────────────
    // Returns current code from Redis. 404 if key is gone (expired or never existed).
    @GetMapping("/{roomId}")
    public RoomResponse getRoom(@PathVariable String roomId) {
        String codeKey = codeKey(roomId);
        String code = redis.opsForValue().get(codeKey);
        if (code == null) throw new RoomNotFoundException(roomId);

        Long ttlSeconds = redis.getExpire(codeKey, TimeUnit.SECONDS);
        Instant expiresAt = (ttlSeconds != null && ttlSeconds > 0)
                ? Instant.now().plusSeconds(ttlSeconds)
                : Instant.now().plus(Duration.ofHours(expiryHours));

        return new RoomResponse(roomId, code, expiresAt);
    }

    public static String codeKey(String roomId) {
        return "room:" + roomId + ":code";
    }
}
