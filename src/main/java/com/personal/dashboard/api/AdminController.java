package com.personal.dashboard.api;

import com.fasterxml.jackson.core.type.TypeReference;
import com.personal.dashboard.auth.AuthService;
import com.personal.dashboard.model.AssessmentResult;
import com.personal.dashboard.model.User;
import com.personal.dashboard.service.AssessmentPaperStore;
import com.personal.dashboard.service.JsonDocService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 账号管理 API（仅一级权限，由拦截器强制校验）：
 * 用户列表、添加用户、重置密码、恢复评估资格、删除用户。
 */
@RestController
@RequestMapping("/api/admin/users")
public class AdminController {

    private final AuthService auth;
    private final JsonDocService docs;
    private final AssessmentPaperStore paperStore;

    public AdminController(AuthService auth, JsonDocService docs, AssessmentPaperStore paperStore) {
        this.auth = auth;
        this.docs = docs;
        this.paperStore = paperStore;
    }

    /** 用户列表（不回传密码哈希与盐） */
    @GetMapping
    public List<Map<String, Object>> list() {
        return auth.users().stream().map(u -> {
            Map<String, Object> m = new LinkedHashMap<String, Object>();
            m.put("username", u.username());
            m.put("name", u.name());
            m.put("level", u.level());
            m.put("assessmentStatus", u.assessmentStatus());
            return m;
        }).toList();
    }

    public record AddUserRequest(String username, String name, int level, String password) {}

    @PostMapping
    public ResponseEntity<?> add(@RequestBody AddUserRequest req) {
        try {
            User u = auth.addUser(req.username(), req.name(), req.level(), req.password());
            return ResponseEntity.ok(Map.of("username", u.username(), "name", u.name(),
                    "level", u.level(), "assessmentStatus", u.assessmentStatus()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    public record PasswordRequest(String password) {}

    /** 重置密码（重置后该用户所有会话失效，需重新登录） */
    @PostMapping("/{username}/reset-password")
    public ResponseEntity<?> resetPassword(@PathVariable String username, @RequestBody PasswordRequest req) {
        try {
            return auth.resetPassword(username, req.password())
                    ? ResponseEntity.ok(Map.of("ok", true))
                    : ResponseEntity.status(404).body(Map.of("error", "用户不存在"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /** 恢复评估资格：状态重置为 NONE，清除缓存试卷与历史结果，可重新评估 */
    @PostMapping("/{username}/reset-assessment")
    public ResponseEntity<?> resetAssessment(@PathVariable String username) {
        User target = auth.users().stream().filter(u -> u.username().equals(username)).findFirst().orElse(null);
        if (target == null) return ResponseEntity.status(404).body(Map.of("error", "用户不存在"));

        auth.saveUser(target.withAssessmentStatus("NONE"));
        paperStore.remove(username);
        Map<String, AssessmentResult> results = docs.load("assessments",
                new TypeReference<LinkedHashMap<String, AssessmentResult>>() {}, LinkedHashMap::new);
        if (results.remove(username) != null) docs.save("assessments", results);
        return ResponseEntity.ok(Map.of("ok", true, "assessmentStatus", "NONE"));
    }

    /** 删除用户（不能删自己，至少保留一名一级管理员） */
    @DeleteMapping("/{username}")
    public ResponseEntity<?> delete(@PathVariable String username, HttpServletRequest req) {
        User operator = (User) req.getAttribute("currentUser");
        try {
            auth.deleteUser(username, operator.username());
            return ResponseEntity.ok(Map.of("deleted", true));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
