package org.code.codelink.controller;

import lombok.RequiredArgsConstructor;
import org.code.codelink.dto.RoomResponse;
import org.code.codelink.exception.RoomNotFoundException;
import org.code.codelink.model.Room;
import org.code.codelink.repository.RoomRepository;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/rooms")
@RequiredArgsConstructor
public class RoomController {

    private final RoomRepository roomRepository;
    private final StringRedisTemplate redis;

    // ── POST /api/rooms ───────────────────────────────────────────────────────
    // Authenticated only — owner always set from JWT.
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public RoomResponse createRoom(@AuthenticationPrincipal UserDetails principal) {
        String roomId = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        Room room = roomRepository.save(new Room(roomId, principal.getUsername()));
        redis.opsForValue().set(codeKey(roomId), "");
        return toResponse(room, "");
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
    public void deleteRoom(@PathVariable String roomId) {
        roomRepository.findByRoomId(roomId)
                .orElseThrow(() -> new RoomNotFoundException(roomId));
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
