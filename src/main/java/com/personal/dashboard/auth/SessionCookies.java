package com.personal.dashboard.auth;

import org.springframework.http.ResponseCookie;

import java.time.Duration;

/** 会话 Cookie 的唯一拼装入口。 */
public final class SessionCookies {

    public static final String NAME = "DASHBOARD_SESSION";

    private SessionCookies() {}

    public static ResponseCookie session(String token, Duration maxAge, boolean secure) {
        return ResponseCookie.from(NAME, token)
                .httpOnly(true)
                .secure(secure)
                .sameSite("Lax")
                .path("/")
                .maxAge(maxAge)
                .build();
    }

    public static ResponseCookie clear(boolean secure) {
        return ResponseCookie.from(NAME, "")
                .httpOnly(true)
                .secure(secure)
                .sameSite("Lax")
                .path("/")
                .maxAge(Duration.ZERO)
                .build();
    }
}
