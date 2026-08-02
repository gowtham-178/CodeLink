package org.code.codelink.dto;

import lombok.Getter;

import java.time.Instant;

@Getter
public class ErrorResponse {
    private final int status;
    private final String error;
    private final String message;
    private final Instant timestamp = Instant.now();

    public ErrorResponse(int status, String error, String message) {
        this.status = status;
        this.error = error;
        this.message = message;
    }
}
