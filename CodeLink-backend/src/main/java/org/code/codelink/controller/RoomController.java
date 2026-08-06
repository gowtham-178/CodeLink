package org.code.codelink.controller;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.code.codelink.dto.CreateRoomRequest;
import org.code.codelink.dto.JoinRoomRequest;
import org.code.codelink.dto.RoomResponse;
import org.code.codelink.exception.RoomNotFoundException;
import org.code.codelink.model.Room;
import org.code.codelink.repository.RoomRepository;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/rooms")
@RequiredArgsConstructor
public class RoomController {

    private final RoomRepository roomRepository;
    private final StringRedisTemplate redis;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    private static final Duration CACHE_TTL = Duration.ofHours(24);

    // ── POST /api/rooms ───────────────────────────────────────────────────────
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public RoomResponse createRoom(
            @RequestBody(required = false) CreateRoomRequest request,
            @AuthenticationPrincipal UserDetails principal) {
        String roomId = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        String rawPassword = (request != null && request.getPassword() != null && !request.getPassword().isBlank())
                ? request.getPassword().trim() : null;

        String sha = rawPassword != null ? sha256(rawPassword) : null;
        if (sha != null && roomRepository.existsByPasswordSha(sha)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "A room with this password already exists.");
        }

        String hashedPassword = rawPassword != null ? passwordEncoder.encode(rawPassword) : null;
        Room room = roomRepository.save(new Room(roomId, principal.getUsername(), hashedPassword, sha));

        if (sha != null) cacheRoom(sha, room);
        redis.opsForValue().set(codeKey(roomId), "", CACHE_TTL);
        return toResponse(room);
    }

    // ── POST /api/rooms/join ──────────────────────────────────────────────────
    @PostMapping("/join")
    public RoomResponse joinRoom(@RequestBody JoinRoomRequest request) {
        if (request == null || request.getPassword() == null || request.getPassword().isBlank())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Room password is required.");

        String raw = request.getPassword().trim();
        String sha = sha256(raw);

        // 1. Try Redis cache — SHA-256 key match guarantees password correctness,
        //    so we skip the expensive BCrypt check (~150ms) on cache hits.
        Map<Object, Object> cached = redis.opsForHash().entries(roomCacheKey(sha));
        if (!cached.isEmpty()) {
            return new RoomResponse(
                    (String) cached.get("roomId"),
                    (String) cached.get("owner"),
                    Instant.parse((String) cached.get("createdAt")));
        }

        // 2. Direct DB lookup by SHA — O(1), no BCrypt scan
        Room room = roomRepository.findByPasswordSha(sha)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No room found with that password."));

        if (!passwordEncoder.matches(raw, room.getPassword()))
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid password.");

        // 3. Re-populate cache
        cacheRoom(sha, room);
        return toResponse(room);
    }

    // ── GET /api/rooms/{roomId} ───────────────────────────────────────────────
    @GetMapping("/{roomId}")
    public RoomResponse getRoom(@PathVariable String roomId) {
        Room room = roomRepository.findByRoomId(roomId)
                .orElseThrow(() -> new RoomNotFoundException(roomId));
        return toResponse(room);
    }

    // ── DELETE /api/rooms/{roomId} ────────────────────────────────────────────
    @DeleteMapping("/{roomId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void deleteRoom(@PathVariable String roomId, @AuthenticationPrincipal UserDetails principal) {
        Room room = roomRepository.findByRoomId(roomId)
                .orElseThrow(() -> new RoomNotFoundException(roomId));
        if (room.getOwnerUsername() != null
                && (principal == null || !room.getOwnerUsername().equals(principal.getUsername()))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the room owner can delete this room.");
        }
        roomRepository.deleteByRoomId(roomId);
        redis.delete(codeKey(roomId));
        // Remove the cache hash if the room had a password
        if (room.getPassword() != null) {
            // We need the SHA to find the key — re-derive it isn't possible from bcrypt.
            // Scan for the hash that maps to this roomId. Since delete is rare, this is acceptable.
            // Alternative: store the SHA key reference. For now, use a reverse-lookup approach.
            deleteRoomCacheByRoomId(roomId);
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** Single Redis Hash key per password — stores all room metadata */
    public static String roomCacheKey(String sha) { return "room:pwd:" + sha; }

    /** Code buffer key — kept separate since WebSocket reads/writes by roomId */
    public static String codeKey(String roomId) { return "room:" + roomId + ":code"; }

    /** Cache room metadata as a single Redis Hash */
    private void cacheRoom(String sha, Room room) {
        String key = roomCacheKey(sha);
        redis.opsForHash().putAll(key, Map.of(
                "roomId",    room.getRoomId(),
                "pwdHash",   room.getPassword(),
                "owner",     room.getOwnerUsername() != null ? room.getOwnerUsername() : "",
                "createdAt", room.getCreatedAt().toString()
        ));
        redis.expire(key, CACHE_TTL);
    }

    /** Delete the cache hash by scanning for the entry that matches the given roomId. */
    private void deleteRoomCacheByRoomId(String roomId) {
        var cursor = redis.scan(org.springframework.data.redis.core.ScanOptions.scanOptions()
                .match("room:pwd:*").count(100).build());
        try {
            while (cursor.hasNext()) {
                String key = cursor.next();
                String cachedRoomId = (String) redis.opsForHash().get(key, "roomId");
                if (roomId.equals(cachedRoomId)) {
                    redis.delete(key);
                    break;
                }
            }
        } finally {
            cursor.close();
        }
    }

    static String sha256(String input) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private RoomResponse toResponse(Room room) {
        return new RoomResponse(room.getRoomId(), room.getOwnerUsername(), room.getCreatedAt());
    }
}
