package org.code.codelink.repository;

import org.code.codelink.model.Room;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface RoomRepository extends JpaRepository<Room, Long> {
    Optional<Room> findByRoomId(String roomId);
    void deleteByRoomId(String roomId);

    @Query("SELECT r FROM Room r WHERE r.password IS NOT NULL")
    List<Room> findAllWithPassword();

    @Query("SELECT COUNT(r) > 0 FROM Room r WHERE r.password IS NOT NULL")
    boolean existsByPasswordNotNull();
}
