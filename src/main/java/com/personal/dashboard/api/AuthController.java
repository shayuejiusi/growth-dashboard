package com.personal.dashboard.api;

import com.personal.dashboard.auth.AuthService;
import com.personal.dashboard.auth.SessionCookies;
import com.personal.dashboard.model.User;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 登录 / 登出 / 当前用户
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService auth;
    private final boolean cookieSecure;

    public AuthController(AuthService auth, @Value("${app.cookie.secure:false}") boolean cookieSecure) {
        this.auth = auth;
        this.cookieSecure = cookieSecure;
    }

    public record LoginRequest(String username, String password) {}

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest req, HttpServletRequest request) {
        AuthService.AuthSession session = auth.login(req.username() == null ? "" : req.username().trim(),
                req.password() == null ? "" : req.password());
        if (session == null) {
            return ResponseEntity.status(401).body(ApiError.of(401, "UNAUTHORIZED",
                    "用户名或密码错误", request.getRequestURI()));
        }
        User u = session.user();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("username", u.username());
        out.put("name", u.name());
        out.put("level", u.level());
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE,
                        SessionCookies.session(session.token(), Duration.ofHours(12), cookieSecure).toString())
                .body(out);
    }

    @GetMapping("/csrf")
    public ResponseEntity<?> csrf(HttpServletRequest req) {
        String csrf = auth.csrfToken((String) req.getAttribute("authToken"));
        if (csrf == null) {
            return ResponseEntity.status(401).body(ApiError.of(401, "UNAUTHORIZED",
                    "未登录或会话已过期", req.getRequestURI()));
        }
        return ResponseEntity.ok(Map.of("csrfToken", csrf));
    }

    @PostMapping("/logout")
    public ResponseEntity<Map<String, Object>> logout(HttpServletRequest req) {
        auth.logout((String) req.getAttribute("authToken"));
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, SessionCookies.clear(cookieSecure).toString())
                .body(Map.of("ok", true));
    }

    @GetMapping("/me")
    public Map<String, Object> me(HttpServletRequest req) {
        User u = (User) req.getAttribute("currentUser");
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("username", u.username());
        out.put("name", u.name());
        out.put("level", u.level());
        out.put("assessmentStatus", u.assessmentStatus());
        return out;
    }
}
