package com.personal.dashboard.api;

import com.personal.dashboard.auth.AuthService;
import com.personal.dashboard.model.User;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 登录 / 登出 / 当前用户
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService auth;

    public AuthController(AuthService auth) {
        this.auth = auth;
    }

    public record LoginRequest(String username, String password) {}

    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@RequestBody LoginRequest req) {
        String token = auth.login(req.username() == null ? "" : req.username().trim(),
                req.password() == null ? "" : req.password());
        if (token == null) {
            return ResponseEntity.status(401).body(Map.of("error", "用户名或密码错误"));
        }
        User u = auth.resolve(token);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("token", token);
        out.put("username", u.username());
        out.put("name", u.name());
        out.put("level", u.level());
        out.put("assessmentStatus", u.assessmentStatus());
        return ResponseEntity.ok(out);
    }

    @PostMapping("/logout")
    public Map<String, Object> logout(HttpServletRequest req) {
        auth.logout((String) req.getAttribute("authToken"));
        return Map.of("ok", true);
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
