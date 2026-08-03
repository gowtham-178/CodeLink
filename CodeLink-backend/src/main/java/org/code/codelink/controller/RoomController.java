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
import java.util.HexFormat;
import java.util.UUID;

@RestController
@RequestMapping("/api/rooms")
@RequiredArgsConstructor
public class RoomController {

    private final RoomRepository roomRepository;
    private final StringRedisTemplate redis;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    // ── POST /api/rooms ───────────────────────────────────────────────────────
    // Authenticated only — owner always set from JWT. Option to set password.
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public RoomResponse createRoom(
            @RequestBody(required = false) CreateRoomRequest request,
            @AuthenticationPrincipal UserDetails principal) {
        String roomId = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        String rawPassword = (request != null && request.getPassword() != null && !request.getPassword().isBlank())
                ? request.getPassword().trim()
                : null;

        String hashedPassword = null;
        if (rawPassword != null) {
            String sha = sha256(rawPassword);
            if (redis.hasKey(pwdLookupKey(sha))) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "A room with this password already exists. Please choose a different password.");
            }
            hashedPassword = passwordEncoder.encode(rawPassword);
        }

        Room room = roomRepository.save(new Room(roomId, principal.getUsername(), hashedPassword));

        if (rawPassword != null) {
            redis.opsForValue().set(pwdLookupKey(sha256(rawPassword)), roomId, Duration.ofHours(1));
            redis.opsForValue().set(pwdHashKey(roomId), hashedPassword, Duration.ofHours(1));
        }
        redis.opsForValue().set(codeKey(roomId), "", Duration.ofHours(1));
        return toResponse(room);
    }

    // ── POST /api/rooms/join ──────────────────────────────────────────────────
    @PostMapping("/join")
    public RoomResponse joinRoom(@RequestBody JoinRoomRequest request) {
        if (request == null || request.getPassword() == null || request.getPassword().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Room password is required.");
        }
        String raw = request.getPassword().trim();
        String sha = sha256(raw);

        // 1. Try Redis index first
        String roomId = redis.opsForValue().get(pwdLookupKey(sha));
        if (roomId != null) {
            String hash = redis.opsForValue().get(pwdHashKey(roomId));
            if (hash == null || !passwordEncoder.matches(raw, hash)) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid password.");
            }
            return toResponse(roomRepository.findByRoomId(roomId)
                    .orElseThrow(() -> new RoomNotFoundException(roomId)));
        }

        // 2. Fall back to DB — find all rooms with a password and BCrypt-match
        Room room = roomRepository.findAllWithPassword().stream()
                .filter(r -> passwordEncoder.matches(raw, r.getPassword()))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No room found with that password."));

        // 3. Populate Redis cache
        redis.opsForValue().set(pwdLookupKey(sha), room.getRoomId(), Duration.ofHours(1));
        redis.opsForValue().set(pwdHashKey(room.getRoomId()), room.getPassword(), Duration.ofHours(1));
        redis.opsForValue().set(codeKey(room.getRoomId()), "", Duration.ofHours(1));

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
        redis.delete(pwdHashKey(roomId)); // lookup key expires on its own TTL
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    public static String codeKey(String roomId)    { return "room:" + roomId + ":code"; }
    public static String pwdHashKey(String roomId) { return "room:" + roomId + ":pwd"; }
    public static String pwdLookupKey(String sha)  { return "room:pwdlookup:" + sha; }

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
