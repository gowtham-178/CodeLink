package org.code.codelink.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "rooms")
@Getter @Setter @NoArgsConstructor
public class Room {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false, length = 12)
    private String roomId;

    // NULL for guest-created rooms — no owner means nobody can Save/Delete
    @Column(nullable = true, length = 50)
    private String ownerUsername;

    @Column(columnDefinition = "TEXT")
    private String content;

    @Column(nullable = false)
    private Instant createdAt;

    public Room(String roomId, String ownerUsername) {
        this.roomId = roomId;
        this.ownerUsername = ownerUsername; // may be null for guests
        this.content = "";
        this.createdAt = Instant.now();
    }
}
