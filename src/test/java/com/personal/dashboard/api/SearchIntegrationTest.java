package com.personal.dashboard.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.personal.dashboard.model.DailyContent;
import com.personal.dashboard.model.TalentBoard;
import com.personal.dashboard.model.TaskItem;
import com.personal.dashboard.service.JsonDocService;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:task3-search;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.frontend-origins=http://localhost:5173",
        "app.cookie.secure=false"
})
@AutoConfigureMockMvc
class SearchIntegrationTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JsonDocService docs;

    private SessionAuth admin;
    private SessionAuth manager;
    private SessionAuth staff;

    @BeforeEach
    void setUp() throws Exception {
        admin = authenticate("admin", "admin123");
        manager = authenticate("manager", "manager123");
        staff = authenticate("staff", "staff123");
        clearTasks(admin);
        clearTasks(manager);
        clearTasks(staff);
        docs.save("talent", new TalentBoard(new LinkedHashMap<>(), new ArrayList<>()));
        docs.save("content", new DailyContent(LocalDate.now(), List.of(),
                new ArrayList<>(), List.of(), null));
    }

    @Test
    void searchHonorsRoleAndNeverReturnsCapabilities() throws Exception {
        TaskItem adminTask = createTask(admin, "德育工作计划", "学部", List.of("领导力"));
        TaskItem staffTask = createTask(staff, "班级德育活动", "德育部", List.of());
        createTask(admin, "普通任务", "行政", List.of("领导力"));
        addPerson("德育导师", "教师组");
        saveContent(List.of(article("德育课程设计", "教育周刊"),
                article("领导力提升指南", "管理月刊")));

        mvc.perform(get("/api/search").param("q", "德育").cookie(staff.session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.people").isEmpty())
                .andExpect(jsonPath("$.content").isEmpty())
                .andExpect(jsonPath("$.tasks.length()").value(1))
                .andExpect(jsonPath("$.tasks[0].id").value(staffTask.id()))
                .andExpect(jsonPath("$.tasks[*].type", everyItem(is("task"))));

        mvc.perform(get("/api/search").param("q", "德育").cookie(admin.session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tasks.length()").value(1))
                .andExpect(jsonPath("$.tasks[0].id").value(adminTask.id()))
                .andExpect(jsonPath("$.people.length()").value(1))
                .andExpect(jsonPath("$.content.length()").value(1));

        mvc.perform(get("/api/search").param("q", "领导力").cookie(admin.session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tasks").isEmpty())
                .andExpect(jsonPath("$.people").isEmpty())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.tasks[*].path", everyItem(not(containsString("assessment")))))
                .andExpect(jsonPath("$.content[*].path", everyItem(not(containsString("assessment")))));

        mvc.perform(get("/api/search").param("q", "领导力").cookie(manager.session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.people").isEmpty())
                .andExpect(jsonPath("$.content.length()").value(1));
    }

    @Test
    void searchMatchesTaskSourceAndPersonNameOnlyForAllowedRoles() throws Exception {
        TaskItem sourceMatch = createTask(admin, "常规工作", "德育部", List.of());
        addPerson("张老师", "语文组");
        saveContent(List.of(article("课堂管理", "德育月刊")));

        mvc.perform(get("/api/search").param("q", "德育").cookie(admin.session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tasks[0].id").value(sourceMatch.id()))
                .andExpect(jsonPath("$.content[0].title").value("课堂管理"));

        mvc.perform(get("/api/search").param("q", "张老师").cookie(admin.session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.people[0].name").doesNotExist())
                .andExpect(jsonPath("$.people[0].title").value("张老师"));

        mvc.perform(get("/api/search").param("q", "张老师").cookie(manager.session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.people").isEmpty());
    }

    @Test
    void emptyResultsAndNormalizedQueriesReturnThreeArrays() throws Exception {
        saveContent(List.of(article("Leadership 基础", "管理月刊")));

        mvc.perform(get("/api/search").param("q", "没有匹配内容").cookie(admin.session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tasks").isArray())
                .andExpect(jsonPath("$.tasks").isEmpty())
                .andExpect(jsonPath("$.people").isArray())
                .andExpect(jsonPath("$.people").isEmpty())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.content").isEmpty());

        mvc.perform(get("/api/search").param("q", "  leadership  ").cookie(admin.session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].title").value("Leadership 基础"));

        String fiftyCharacters = "x".repeat(50);
        mvc.perform(get("/api/search").param("q", "  " + fiftyCharacters + "  ")
                        .cookie(admin.session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tasks").isEmpty())
                .andExpect(jsonPath("$.people").isEmpty())
                .andExpect(jsonPath("$.content").isEmpty());
    }

    @Test
    void blankAndLongQueriesAreRejected() throws Exception {
        mvc.perform(get("/api/search").param("q", " ").cookie(admin.session()))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/search").param("q", "x".repeat(51)).cookie(admin.session()))
                .andExpect(status().isBadRequest());
    }

    @Test
    void eachResultGroupIsLimitedToFiveItems() throws Exception {
        for (int i = 0; i < 6; i++) {
            createTask(admin, "共同任务" + i, "共同来源", List.of());
            addPerson("共同成员" + i, "共同组");
        }
        List<DailyContent.ContentItem> articles = new ArrayList<>();
        for (int i = 0; i < 6; i++) {
            articles.add(article("共同文章" + i, "共同来源"));
        }
        saveContent(articles);

        mvc.perform(get("/api/search").param("q", "共同").cookie(admin.session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tasks.length()").value(5))
                .andExpect(jsonPath("$.people.length()").value(5))
                .andExpect(jsonPath("$.content.length()").value(5));
    }

    @Test
    void resultPathsAreGeneratedByTheServer() throws Exception {
        TaskItem task = createTask(admin, "唯一任务路径", "学部", List.of());
        TalentBoard.PersonNote person = addPerson("唯一人员路径", "教师组");
        String title = "成长 & 发展";
        saveContent(List.of(article(title, "管理月刊")));

        mvc.perform(get("/api/search").param("q", task.title()).cookie(admin.session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tasks[0].path").value("/tasks?focus=" + task.id()));
        mvc.perform(get("/api/search").param("q", person.name()).cookie(admin.session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.people[0].path").value("/talent?person=" + person.id()));
        mvc.perform(get("/api/search").param("q", title).cookie(admin.session()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].id").value(title))
                .andExpect(jsonPath("$.content[0].path").value("/content?item="
                        + URLEncoder.encode(title, StandardCharsets.UTF_8)));
    }

    private TaskItem createTask(SessionAuth auth, String title, String source,
                                List<String> capabilities) throws Exception {
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("title", title);
        request.put("source", source);
        request.put("capabilities", capabilities);
        MvcResult result = mvc.perform(post("/api/tasks").cookie(auth.session())
                        .header("X-CSRF-TOKEN", auth.csrf())
                        .contentType(APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readValue(result.getResponse().getContentAsString(), TaskItem.class);
    }

    private TalentBoard.PersonNote addPerson(String name, String roster) throws Exception {
        MvcResult result = mvc.perform(post("/api/talent/people").cookie(admin.session())
                        .header("X-CSRF-TOKEN", admin.csrf())
                        .contentType(APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", name, "roster", roster,
                                "performance", 2, "potential", 2,
                                "observation", "搜索测试观察记录"))))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readValue(result.getResponse().getContentAsString(),
                TalentBoard.PersonNote.class);
    }

    private DailyContent.ContentItem article(String title, String source) {
        return new DailyContent.ContentItem(title, "https://example.com/article", source,
                List.of(), null);
    }

    private void saveContent(List<DailyContent.ContentItem> articles) {
        docs.save("content", new DailyContent(LocalDate.now(), List.of(), articles, List.of(), null));
    }

    private void clearTasks(SessionAuth auth) throws Exception {
        mvc.perform(delete("/api/tasks").cookie(auth.session())
                        .header("X-CSRF-TOKEN", auth.csrf()))
                .andExpect(status().isOk());
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
