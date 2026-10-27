package com.personal.dashboard.api;

import java.time.Instant;
import java.util.UUID;

public record ApiError(String timestamp, int status, String code, String message,
                       String path, String requestId) {

    public static ApiError of(int status, String code, String message, String path) {
        return new ApiError(Instant.now().toString(), status, code, message, path,
                UUID.randomUUID().toString());
    }
}
