package com.personal.dashboard.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:task1-auth;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.frontend-origins=http://localhost:5173,https://dashboard.example.com",
        "app.cookie.secure=false"
})
@AutoConfigureMockMvc
@Import(AuthApiIntegrationTest.FaultController.class)
class AuthApiIntegrationTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void loginSetsHttpOnlyCookieAndCsrfProtectsWrites() throws Exception {
        MvcResult login = login("admin", "admin123")
                .andExpect(cookie().httpOnly("DASHBOARD_SESSION", true))
                .andExpect(cookie().secure("DASHBOARD_SESSION", false))
                .andExpect(cookie().sameSite("DASHBOARD_SESSION", "Lax"))
                .andExpect(cookie().path("DASHBOARD_SESSION", "/"))
                .andExpect(cookie().maxAge("DASHBOARD_SESSION", 12 * 60 * 60))
                .andExpect(jsonPath("$.username").value("admin"))
                .andExpect(jsonPath("$.name").value("系统管理员"))
                .andExpect(jsonPath("$.level").value(1))
                .andExpect(jsonPath("$.token").doesNotExist())
                .andExpect(jsonPath("$.assessmentStatus").doesNotExist())
                .andReturn();

        Cookie session = login.getResponse().getCookie("DASHBOARD_SESSION");
        assertNotNull(session);
        MvcResult csrfResult = mvc.perform(get("/api/auth/csrf").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.csrfToken").isString())
                .andReturn();
        String csrf = objectMapper.readTree(csrfResult.getResponse().getContentAsString())
                .get("csrfToken").asText();
        assertFalse(csrf.isBlank());
        assertNotEquals(session.getValue(), csrf);

        mvc.perform(post("/api/auth/logout").cookie(session))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403))
                .andExpect(jsonPath("$.code").value("CSRF_INVALID"))
                .andExpect(jsonPath("$.message").isString())
                .andExpect(jsonPath("$.path").value("/api/auth/logout"))
                .andExpect(jsonPath("$.requestId").isNotEmpty())
                .andExpect(jsonPath("$.timestamp").isNotEmpty());

        mvc.perform(post("/api/auth/logout").cookie(session)
                        .header("X-CSRF-TOKEN", "incorrect"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_INVALID"));

        mvc.perform(post("/api/auth/logout").cookie(session)
                        .header("X-CSRF-TOKEN", csrf))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ok").value(true))
                .andExpect(cookie().httpOnly("DASHBOARD_SESSION", true))
                .andExpect(cookie().maxAge("DASHBOARD_SESSION", 0))
                .andExpect(cookie().sameSite("DASHBOARD_SESSION", "Lax"));

        mvc.perform(get("/api/auth/me").cookie(session))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void corsOnlyAllowsConfiguredFrontendAndExemptsPreflight() throws Exception {
        mvc.perform(options("/api/auth/login")
                        .header(HttpHeaders.ORIGIN, "http://localhost:5173")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "Content-Type,X-CSRF-TOKEN"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN,
                        "http://localhost:5173"))
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_CREDENTIALS, "true"))
                .andExpect(header().string(HttpHeaders.VARY, containsString("Origin")));

        mvc.perform(options("/api/tasks")
                        .header(HttpHeaders.ORIGIN, "https://dashboard.example.com")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN,
                        "https://dashboard.example.com"));

        mvc.perform(options("/api/auth/login")
                        .header(HttpHeaders.ORIGIN, "https://attacker.example")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST"))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN));
    }

    @Test
    void bearerRemainsCompatibleButCannotBypassCsrfWhenCookieIsPresent() throws Exception {
        Cookie session = login("admin", "admin123").andReturn()
                .getResponse().getCookie("DASHBOARD_SESSION");
        assertNotNull(session);

        mvc.perform(get("/api/auth/me")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + session.getValue()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("admin"));

        mvc.perform(post("/api/auth/logout").cookie(session)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + session.getValue()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_INVALID"));

        mvc.perform(post("/api/auth/logout")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + session.getValue()))
                .andExpect(status().isOk());
    }

    @Test
    void authenticationFailuresUseUnifiedApiError() throws Exception {
        mvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
                .andExpect(jsonPath("$.message").value("未登录或会话已过期"))
                .andExpect(jsonPath("$.path").value("/api/auth/me"))
                .andExpect(jsonPath("$.requestId").isNotEmpty())
                .andExpect(jsonPath("$.timestamp").isNotEmpty());

        mvc.perform(post("/api/auth/login").contentType(APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"wrong\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
                .andExpect(jsonPath("$.path").value("/api/auth/login"))
                .andExpect(jsonPath("$.requestId").isNotEmpty());
    }

    @Test
    void forbiddenPermissionsUseUnifiedApiError() throws Exception {
        Cookie staff = login("staff", "staff123").andReturn()
                .getResponse().getCookie("DASHBOARD_SESSION");

        mvc.perform(get("/api/admin/users").cookie(staff))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403))
                .andExpect(jsonPath("$.code").value("FORBIDDEN"))
                .andExpect(jsonPath("$.path").value("/api/admin/users"))
                .andExpect(jsonPath("$.requestId").isNotEmpty());
    }

    @Test
    void malformedRequestsAndMissingResourcesUseUnifiedApiError() throws Exception {
        mvc.perform(post("/api/auth/login").contentType(APPLICATION_JSON)
                        .content("{\"username\":"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"))
                .andExpect(jsonPath("$.path").value("/api/auth/login"))
                .andExpect(jsonPath("$.requestId").isNotEmpty())
                .andExpect(jsonPath("$.timestamp").isNotEmpty());

        Cookie session = login("admin", "admin123").andReturn()
                .getResponse().getCookie("DASHBOARD_SESSION");
        mvc.perform(get("/api/not-a-resource").cookie(session))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.code").value("NOT_FOUND"))
                .andExpect(jsonPath("$.path").value("/api/not-a-resource"))
                .andExpect(jsonPath("$.requestId").isNotEmpty());
    }

    @Test
    void legacyFrontendFilesRemainOnDiskButAreNotServed() throws Exception {
        mvc.perform(get("/"))
                .andExpect(status().isNotFound());
        mvc.perform(get("/index.html"))
                .andExpect(status().isNotFound());
        mvc.perform(get("/tasks"))
                .andExpect(status().isNotFound());
    }

    @Test
    void unexpectedErrorsDoNotLeakExceptionDetails() throws Exception {
        Cookie session = login("admin", "admin123").andReturn()
                .getResponse().getCookie("DASHBOARD_SESSION");

        MvcResult result = mvc.perform(get("/api/test/unexpected-error").cookie(session))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.status").value(500))
                .andExpect(jsonPath("$.code").value("INTERNAL_ERROR"))
                .andExpect(jsonPath("$.message").value("服务器内部错误"))
                .andExpect(jsonPath("$.path").value("/api/test/unexpected-error"))
                .andExpect(jsonPath("$.requestId").isNotEmpty())
                .andExpect(jsonPath("$.timestamp").isNotEmpty())
                .andReturn();

        String body = result.getResponse().getContentAsString();
        assertFalse(body.contains("IllegalStateException"));
        assertFalse(body.contains("sensitive test failure"));
        String requestId = objectMapper.readTree(body).get("requestId").asText();
        UUID.fromString(requestId);
        assertTrue(objectMapper.readTree(body).get("timestamp").asText().endsWith("Z"));
    }

    private ResultActions login(String username, String password) throws Exception {
        return mvc.perform(post("/api/auth/login").contentType(APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new LoginBody(username, password))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").doesNotExist());
    }

    private record LoginBody(String username, String password) {}

    @RestController
    static class FaultController {
        @GetMapping("/api/test/unexpected-error")
        String unexpectedError() {
            throw new IllegalStateException("sensitive test failure");
        }
    }
}
