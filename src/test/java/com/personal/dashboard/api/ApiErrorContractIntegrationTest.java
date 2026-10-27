package com.personal.dashboard.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:task1-api-errors;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.frontend-origins=http://localhost:5173",
        "app.cookie.secure=false"
})
@AutoConfigureMockMvc
class ApiErrorContractIntegrationTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void directControllerBadRequestUsesSixFieldApiError() throws Exception {
        SessionAuth admin = authenticate("admin", "admin123");

        ResultActions response = mvc.perform(post("/api/talent/rosters")
                .cookie(admin.session())
                .header("X-CSRF-TOKEN", admin.csrf())
                .contentType(APPLICATION_JSON)
                .content("{\"name\":\" \"}"));

        expectApiError(response, 400, "BAD_REQUEST", "/api/talent/rosters", "名册名称不能为空");
    }

    @Test
    void directControllerNotFoundUsesSixFieldApiError() throws Exception {
        SessionAuth admin = authenticate("admin", "admin123");

        ResultActions response = mvc.perform(post("/api/admin/users/no-such-user/reset-password")
                .cookie(admin.session())
                .header("X-CSRF-TOKEN", admin.csrf())
                .contentType(APPLICATION_JSON)
                .content("{\"password\":\"newpass123\"}"));

        expectApiError(response, 404, "NOT_FOUND",
                "/api/admin/users/no-such-user/reset-password", "用户不存在");
    }

    @Test
    void directControllerConflictUsesSixFieldApiError() throws Exception {
        SessionAuth manager = authenticate("manager", "manager123");
        mvc.perform(post("/api/assessment/skip")
                        .cookie(manager.session())
                        .header("X-CSRF-TOKEN", manager.csrf()))
                .andExpect(status().isOk());

        ResultActions response = mvc.perform(get("/api/assessment/questions")
                .cookie(manager.session()));

        expectApiError(response, 409, "CONFLICT", "/api/assessment/questions",
                "您已跳过评估，该功能不可用");
    }

    private SessionAuth authenticate(String username, String password) throws Exception {
        MvcResult login = mvc.perform(post("/api/auth/login")
                        .contentType(APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new LoginBody(username, password))))
                .andExpect(status().isOk())
                .andReturn();
        Cookie session = login.getResponse().getCookie("DASHBOARD_SESSION");
        assertNotNull(session);
        MvcResult csrf = mvc.perform(get("/api/auth/csrf").cookie(session))
                .andExpect(status().isOk())
                .andReturn();
        String token = objectMapper.readTree(csrf.getResponse().getContentAsString())
                .get("csrfToken").asText();
        return new SessionAuth(session, token);
    }

    private void expectApiError(ResultActions response, int expectedStatus, String code,
                                String path, String message) throws Exception {
        response.andExpect(status().is(expectedStatus))
                .andExpect(jsonPath("$.timestamp").isNotEmpty())
                .andExpect(jsonPath("$.status").value(expectedStatus))
                .andExpect(jsonPath("$.code").value(code))
                .andExpect(jsonPath("$.message").value(message))
                .andExpect(jsonPath("$.path").value(path))
                .andExpect(jsonPath("$.requestId").isNotEmpty())
                .andExpect(jsonPath("$.error").doesNotExist());
    }

    private record LoginBody(String username, String password) {}

    private record SessionAuth(Cookie session, String csrf) {}
}
