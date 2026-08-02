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
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

@RestController
@RequestMapping("/api/rooms")
@RequiredArgsConstructor
public class RoomController {

    private final RoomRepository roomRepository;
    private final StringRedisTemplate redis;

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
        Room room = roomRepository.save(new Room(roomId, principal.getUsername(), rawPassword));
        redis.opsForValue().set(codeKey(roomId), "");
        return toResponse(room, "");
    }

    // ── POST /api/rooms/join ──────────────────────────────────────────────────
    // Joins room by password only.
    @PostMapping("/join")
    public RoomResponse joinRoom(@RequestBody JoinRoomRequest request) {
        if (request == null || request.getPassword() == null || request.getPassword().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Room password is required.");
        }
        Room room = roomRepository.findFirstByPasswordOrderByCreatedAtDesc(request.getPassword().trim())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No room found with that password."));

        String code = redis.opsForValue().get(codeKey(room.getRoomId()));
        if (code == null) {
            code = room.getContent() != null ? room.getContent() : "";
            redis.opsForValue().set(codeKey(room.getRoomId()), code);
        }
        return toResponse(room, code);
    }

    // ── GET /api/rooms/{roomId} ───────────────────────────────────────────────
    @GetMapping("/{roomId}")
    public RoomResponse getRoom(@PathVariable String roomId) {
        Room room = roomRepository.findByRoomId(roomId)
                .orElseThrow(() -> new RoomNotFoundException(roomId));
        String code = redis.opsForValue().get(codeKey(roomId));
        if (code == null) {
            code = room.getContent() != null ? room.getContent() : "";
            redis.opsForValue().set(codeKey(roomId), code);
        }
        return toResponse(room, code);
    }

    // ── DELETE /api/rooms/{roomId} ────────────────────────────────────────────
    @DeleteMapping("/{roomId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void deleteRoom(@PathVariable String roomId, @AuthenticationPrincipal UserDetails principal) {
        Room room = roomRepository.findByRoomId(roomId)
                .orElseThrow(() -> new RoomNotFoundException(roomId));
        if (room.getOwnerUsername() != null && (principal == null || !room.getOwnerUsername().equals(principal.getUsername()))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the room owner can delete this room.");
        }
        roomRepository.deleteByRoomId(roomId);
        redis.delete(codeKey(roomId));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    public static String codeKey(String roomId) {
        return "room:" + roomId + ":code";
    }

    private RoomResponse toResponse(Room room, String code) {
        return new RoomResponse(room.getRoomId(), room.getOwnerUsername(), code, room.getCreatedAt());
    }
}
