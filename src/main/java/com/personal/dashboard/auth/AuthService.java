package com.personal.dashboard.auth;

import com.personal.dashboard.entity.UserEntity;
import com.personal.dashboard.model.User;
import com.personal.dashboard.repo.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 认证服务：账号校验 + 令牌会话（内存态，有效期 12 小时）。
 * 用户数据存于数据库 users 表。
 */
@Service
public class AuthService {

    private static final long SESSION_MILLIS = 12L * 3600 * 1000;

    private final UserRepository repo;
    private final Map<String, Session> tokens = new ConcurrentHashMap<>();

    public record AuthSession(String token, String csrfToken, User user) {}

    private record Session(String username, long expiresAt, String csrfToken) {}

    public AuthService(UserRepository repo) {
        this.repo = repo;
    }

    public List<User> users() {
        return repo.findAll().stream().map(UserEntity::toRecord).toList();
    }

    @Transactional
    public void saveUser(User user) {
        repo.save(UserEntity.from(user));
    }

    /** 登录成功返回会话与 CSRF 令牌，失败返回 null */
    public AuthSession login(String username, String password) {
        return repo.findById(username)
                .filter(u -> hash(u.getSalt(), password).equals(u.getPasswordHash()))
                .map(u -> {
                    String token = randomToken();
                    String csrf = randomToken();
                    tokens.put(token, new Session(username,
                            System.currentTimeMillis() + SESSION_MILLIS, csrf));
                    return new AuthSession(token, csrf, u.toRecord());
                })
                .orElse(null);
    }

    /** 解析令牌 → 用户；无效或过期返回 null */
    public User resolve(String token) {
        if (token == null || token.isBlank()) return null;
        Session s = tokens.get(token);
        if (s == null || s.expiresAt() < System.currentTimeMillis()) {
            tokens.remove(token);
            return null;
        }
        return repo.findById(s.username()).map(UserEntity::toRecord).orElse(null);
    }

    public String csrfToken(String token) {
        if (token == null || token.isBlank()) return null;
        Session s = tokens.get(token);
        if (s == null || s.expiresAt() < System.currentTimeMillis()) {
            tokens.remove(token);
            return null;
        }
        return s.csrfToken();
    }

    public boolean validCsrf(String token, String csrf) {
        if (token == null || csrf == null) return false;
        Session s = tokens.get(token);
        return s != null && s.expiresAt() >= System.currentTimeMillis()
                && MessageDigest.isEqual(
                        s.csrfToken().getBytes(StandardCharsets.UTF_8),
                        csrf.getBytes(StandardCharsets.UTF_8));
    }

    private static String randomToken() {
        return UUID.randomUUID().toString().replace("-", "")
                + UUID.randomUUID().toString().replace("-", "");
    }

    public void logout(String token) {
        if (token != null) tokens.remove(token);
    }

    // ==================== 账号管理（仅一级权限调用） ====================

    /** 添加用户；用户名已存在或参数非法时抛出 IllegalArgumentException */
    @Transactional
    public synchronized User addUser(String username, String name, int level, String password) {
        if (username == null || username.isBlank() || !username.matches("[a-zA-Z0-9_]{2,20}")) {
            throw new IllegalArgumentException("用户名需为 2-20 位字母、数字或下划线");
        }
        if (password == null || password.length() < 6) {
            throw new IllegalArgumentException("密码至少 6 位");
        }
        if (level < 1 || level > 3) {
            throw new IllegalArgumentException("权限等级只能为 1、2、3");
        }
        if (repo.existsById(username)) throw new IllegalArgumentException("用户名已存在");
        String salt = randomSalt();
        User user = new User(username, name == null || name.isBlank() ? username : name,
                level, salt, hash(salt, password), "NONE");
        repo.save(UserEntity.from(user));
        return user;
    }

    /** 重置密码；用户不存在返回 false。重置后该用户所有会话失效 */
    @Transactional
    public synchronized boolean resetPassword(String username, String newPassword) {
        if (newPassword == null || newPassword.length() < 6) {
            throw new IllegalArgumentException("密码至少 6 位");
        }
        return repo.findById(username).map(e -> {
            String salt = randomSalt();
            e.setSalt(salt);
            e.setPasswordHash(hash(salt, newPassword));
            repo.save(e);
            tokens.values().removeIf(s -> s.username().equals(username));
            return true;
        }).orElse(false);
    }

    /** 删除用户；不允许删除自己，不允许删除最后一名一级管理员 */
    @Transactional
    public synchronized void deleteUser(String username, String operator) {
        if (username.equals(operator)) throw new IllegalArgumentException("不能删除当前登录的管理员账号");
        UserEntity target = repo.findById(username)
                .orElseThrow(() -> new IllegalArgumentException("用户不存在"));
        if (target.getLevel() == 1 && repo.countByLevel(1) <= 1) {
            throw new IllegalArgumentException("至少保留一名一级权限管理员");
        }
        repo.deleteById(username);
        tokens.values().removeIf(s -> s.username().equals(username));
    }

    private static String randomSalt() {
        byte[] saltBytes = new byte[8];
        new SecureRandom().nextBytes(saltBytes);
        return HexFormat.of().formatHex(saltBytes);
    }

    static String hash(String salt, String password) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest((salt + password).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
