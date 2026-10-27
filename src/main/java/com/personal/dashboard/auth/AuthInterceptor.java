package com.personal.dashboard.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.personal.dashboard.api.ApiError;
import com.personal.dashboard.model.User;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.Set;

/**
 * 权限拦截器：先验登录令牌，再按三级权限校验路径。
 *
 *  一级：全部内容
 *  二级：除「日复盘与人才筛选」(/api/review, /api/talent) 外全部
 *  三级：仅「今日驾驶舱、工作任务管理器、待办提醒中心」(/api/dashboard, /api/tasks, /api/reminders)
 */
@Component
public class AuthInterceptor implements HandlerInterceptor {

    private static final Set<String> WRITE_METHODS = Set.of("POST", "PUT", "PATCH", "DELETE");

    private final AuthService auth;
    private final ObjectMapper mapper;

    public AuthInterceptor(AuthService auth, ObjectMapper mapper) {
        this.auth = auth;
        this.mapper = mapper;
    }

    @Override
    public boolean preHandle(HttpServletRequest req, HttpServletResponse resp, Object handler) throws Exception {
        String path = req.getRequestURI();
        if ("OPTIONS".equals(req.getMethod()) || "/api/auth/login".equals(path)) return true;

        Cookie sessionCookie = sessionCookie(req);
        boolean cookieSession = sessionCookie != null;
        String token = cookieSession ? sessionCookie.getValue() : extractLegacyToken(req);
        User user = auth.resolve(token);
        if (user == null) {
            reject(req, resp, 401, "UNAUTHORIZED", "未登录或会话已过期");
            return false;
        }

        if (cookieSession && WRITE_METHODS.contains(req.getMethod())
                && !auth.validCsrf(token, req.getHeader("X-CSRF-TOKEN"))) {
            reject(req, resp, 403, "CSRF_INVALID", "CSRF 令牌缺失或无效");
            return false;
        }

        boolean allowed = switch (user.level()) {
            case 1 -> true;
            case 2 -> !(path.startsWith("/api/review") || path.startsWith("/api/talent")
                    || path.startsWith("/api/admin"));
            case 3 -> path.startsWith("/api/dashboard") || path.startsWith("/api/tasks")
                    || path.startsWith("/api/reminders") || path.startsWith("/api/auth/")
                    || path.startsWith("/api/ai/") || path.startsWith("/api/search");
            default -> false;
        };
        if (!allowed) {
            reject(req, resp, 403, "FORBIDDEN", "当前权限等级无法访问该功能");
            return false;
        }

        req.setAttribute("currentUser", user);
        req.setAttribute("authToken", token);
        return true;
    }

    private Cookie sessionCookie(HttpServletRequest req) {
        if (req.getCookies() == null) return null;
        for (Cookie cookie : req.getCookies()) {
            if (SessionCookies.NAME.equals(cookie.getName())) return cookie;
        }
        return null;
    }

    private String extractLegacyToken(HttpServletRequest req) {
        String header = req.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) return header.substring(7);
        return req.getHeader("X-Token");
    }

    private void reject(HttpServletRequest req, HttpServletResponse resp, int status,
                        String code, String message) throws Exception {
        resp.setStatus(status);
        resp.setContentType("application/json;charset=UTF-8");
        resp.getWriter().write(mapper.writeValueAsString(
                ApiError.of(status, code, message, req.getRequestURI())));
    }
}
