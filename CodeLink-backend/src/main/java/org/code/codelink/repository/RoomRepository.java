package org.code.codelink.repository;

import org.code.codelink.model.Room;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface RoomRepository extends JpaRepository<Room, Long> {
    Optional<Room> findByRoomId(String roomId);
    Optional<Room> findFirstByPasswordOrderByCreatedAtDesc(String password);
    void deleteByRoomId(String roomId);
}
