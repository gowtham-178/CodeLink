package org.code.codelink.exception;

public class RoomNotFoundException extends RuntimeException {
    public RoomNotFoundException(String roomId) {
        super("Room not found or has expired: " + roomId);
    }
}
