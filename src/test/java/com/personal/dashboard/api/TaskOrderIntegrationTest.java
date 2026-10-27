package com.personal.dashboard.api;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.personal.dashboard.model.TaskItem;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:task2-order;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.frontend-origins=http://localhost:5173",
        "app.cookie.secure=false"
})
@AutoConfigureMockMvc
class TaskOrderIntegrationTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper objectMapper;

    private Cookie adminSession;
    private Cookie staffSession;
    private String adminCsrf;
    private String staffCsrf;

    @BeforeEach
    void setUp() throws Exception {
        SessionAuth admin = authenticate("admin", "admin123");
        SessionAuth staff = authenticate("staff", "staff123");
        adminSession = admin.session();
        adminCsrf = admin.csrf();
        staffSession = staff.session();
        staffCsrf = staff.csrf();
        clearTasks(adminSession, adminCsrf);
        clearTasks(staffSession, staffCsrf);
        createTask("第一项任务");
        createTask("第二项任务");
    }

    @Test
    void reorderPersistsForOwnerAndRejectsStaleVersion() throws Exception {
        List<TaskItem> mine = listTasks("admin");
        List<TaskItem> reversed = new ArrayList<>(mine);
        Collections.reverse(reversed);

        mvc.perform(put("/api/tasks/order").cookie(adminSession)
                        .header("X-CSRF-TOKEN", adminCsrf)
                        .contentType(APPLICATION_JSON).content(orderJson(reversed)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(reversed.get(0).id()))
                .andExpect(jsonPath("$[0].position").value(0));

        mvc.perform(get("/api/tasks").cookie(adminSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].id").value(reversed.get(0).id()))
                .andExpect(jsonPath("$[0].position").value(0))
                .andExpect(jsonPath("$[1].id").value(reversed.get(1).id()))
                .andExpect(jsonPath("$[1].position").value(1));

        mvc.perform(put("/api/tasks/order").cookie(adminSession)
                        .header("X-CSRF-TOKEN", adminCsrf)
                        .contentType(APPLICATION_JSON).content(orderJson(reversed)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("TASK_ORDER_CONFLICT"));

        mvc.perform(get("/api/tasks").cookie(staffSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].id", not(hasItem(mine.get(0).id()))));
    }

    @Test
    void reorderResponseVersionCanBeUsedForNextReorder() throws Exception {
        List<TaskItem> reversed = new ArrayList<>(listTasks("admin"));
        Collections.reverse(reversed);

        MvcResult firstResult = mvc.perform(put("/api/tasks/order").cookie(adminSession)
                        .header("X-CSRF-TOKEN", adminCsrf)
                        .contentType(APPLICATION_JSON).content(orderJson(reversed)))
                .andExpect(status().isOk())
                .andReturn();
        List<TaskItem> nextOrder = new ArrayList<>(readTasks(firstResult));
        Collections.reverse(nextOrder);

        mvc.perform(put("/api/tasks/order").cookie(adminSession)
                        .header("X-CSRF-TOKEN", adminCsrf)
                        .contentType(APPLICATION_JSON).content(orderJson(nextOrder)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(nextOrder.get(0).id()))
                .andExpect(jsonPath("$[0].version").value(2));
    }

    @Test
    void createAfterDeletingMiddleUsesMaximumPositionPlusOne() throws Exception {
        createTask("第三项任务");
        List<TaskItem> mine = listTasks("admin");
        List<TaskItem> reordered = List.of(mine.get(1), mine.get(0), mine.get(2));
        mvc.perform(put("/api/tasks/order").cookie(adminSession)
                        .header("X-CSRF-TOKEN", adminCsrf)
                        .contentType(APPLICATION_JSON).content(orderJson(reordered)))
                .andExpect(status().isOk());

        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .delete("/api/tasks/{id}", reordered.get(1).id()).cookie(adminSession)
                        .header("X-CSRF-TOKEN", adminCsrf))
                .andExpect(status().isOk());
        TaskItem created = createTask("删除后新建任务");

        mvc.perform(get("/api/tasks").cookie(adminSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].id").value(reordered.get(0).id()))
                .andExpect(jsonPath("$[1].id").value(reordered.get(2).id()))
                .andExpect(jsonPath("$[2].id").value(created.id()))
                .andExpect(jsonPath("$[2].position").value(3));
    }

    @Test
    void reorderRejectsMissingAndDuplicateIds() throws Exception {
        List<TaskItem> mine = listTasks("admin");

        expectBadRequest(mine.subList(0, 1));
        expectBadRequest(List.of(mine.get(0), mine.get(0)));

        mvc.perform(get("/api/tasks").cookie(adminSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(mine.get(0).id()))
                .andExpect(jsonPath("$[1].id").value(mine.get(1).id()));
    }

    @Test
    void reorderRejectsForeignIdAndPreservesOwnerIsolation() throws Exception {
        List<TaskItem> mine = listTasks("admin");
        TaskItem foreign = createTask("他人任务", staffSession, staffCsrf);

        expectBadRequest(List.of(mine.get(0), foreign));

        mvc.perform(get("/api/tasks").cookie(adminSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].id").value(mine.get(0).id()))
                .andExpect(jsonPath("$[1].id").value(mine.get(1).id()));
        mvc.perform(get("/api/tasks").cookie(staffSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(foreign.id()))
                .andExpect(jsonPath("$[*].id", not(hasItem(mine.get(0).id()))));
    }

    @Test
    void reorderRejectsNullTaskList() throws Exception {
        mvc.perform(put("/api/tasks/order").cookie(adminSession)
                        .header("X-CSRF-TOKEN", adminCsrf)
                        .contentType(APPLICATION_JSON).content(orderPayloadJson(null)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"));
    }

    @Test
    void reorderRejectsNullTaskElement() throws Exception {
        List<TaskItem> mine = listTasks("admin");
        List<Map<String, Object>> items = new ArrayList<>();
        items.add(orderItem(mine.get(0)));
        items.add(null);

        mvc.perform(put("/api/tasks/order").cookie(adminSession)
                        .header("X-CSRF-TOKEN", adminCsrf)
                        .contentType(APPLICATION_JSON).content(orderPayloadJson(items)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"));
    }

    private void expectBadRequest(List<TaskItem> tasks) throws Exception {
        mvc.perform(put("/api/tasks/order").cookie(adminSession)
                        .header("X-CSRF-TOKEN", adminCsrf)
                        .contentType(APPLICATION_JSON).content(orderJson(tasks)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"));
    }

    private void clearTasks(Cookie session, String csrf) throws Exception {
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .delete("/api/tasks").cookie(session).header("X-CSRF-TOKEN", csrf))
                .andExpect(status().isOk());
    }

    private TaskItem createTask(String title) throws Exception {
        return createTask(title, adminSession, adminCsrf);
    }

    private TaskItem createTask(String title, Cookie session, String csrf) throws Exception {
        MvcResult result = mvc.perform(post("/api/tasks").cookie(session)
                        .header("X-CSRF-TOKEN", csrf)
                        .contentType(APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("title", title))))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readValue(result.getResponse().getContentAsString(), TaskItem.class);
    }

    private List<TaskItem> listTasks(String username) throws Exception {
        Cookie session = "admin".equals(username) ? adminSession : staffSession;
        MvcResult result = mvc.perform(get("/api/tasks").cookie(session))
                .andExpect(status().isOk())
                .andReturn();
        return readTasks(result);
    }

    private List<TaskItem> readTasks(MvcResult result) throws Exception {
        return objectMapper.readValue(result.getResponse().getContentAsString(),
                new TypeReference<>() {});
    }

    private Map<String, Object> orderItem(TaskItem task) {
        JsonNode serialized = objectMapper.valueToTree(task);
        JsonNode version = serialized.get("version");
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", task.id());
        item.put("version", version == null ? 0 : version.asLong());
        return item;
    }

    private String orderJson(List<TaskItem> tasks) throws Exception {
        return orderPayloadJson(tasks.stream().map(this::orderItem).toList());
    }

    private String orderPayloadJson(List<Map<String, Object>> items) throws Exception {
        return objectMapper.writeValueAsString(Collections.singletonMap("tasks", items));
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

    private record LoginBody(String username, String password) {}

    private record SessionAuth(Cookie session, String csrf) {}
}
