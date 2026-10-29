package com.personal.dashboard.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.personal.dashboard.ai.AiService.TaskDraft;
import com.personal.dashboard.ai.OpenAiCompatibleAiService.AiCallException;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;

class OpenAiCompatibleAiServiceTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private final AtomicReference<String> requestBody = new AtomicReference<>();
    private HttpServer server;
    private OpenAiCompatibleAiService service;
    private String responseContent = "{}";

    @BeforeEach
    void setUp() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/chat/completions", exchange -> {
            requestBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] response = mapper.writeValueAsBytes(Map.of("choices", List.of(
                    Map.of("message", Map.of("content", responseContent)))));
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, response.length);
            exchange.getResponseBody().write(response);
            exchange.close();
        });
        server.start();

        AiProperties props = new AiProperties();
        props.setBaseUrl("http://127.0.0.1:" + server.getAddress().getPort() + "/v1");
        props.setApiKey("test-key");
        props.setModel("qwen3.8-flash");
        service = new OpenAiCompatibleAiService(props, mapper);
    }

    @AfterEach
    void tearDown() {
        server.stop(0);
    }

    @Test
    void extractsCategorizedTasksFromEnvelope() {
        responseContent = """
                {"tasks":[{"title":"完成心理健康排查","priority":"P0","dueDate":"2026-10-30",
                "needReport":true,"category":"德育","sourceText":"于10月30日前完成心理健康排查并报送",
                "confidence":0.95,"needsReview":false,"reviewReason":null}]}
                """;

        List<TaskDraft> drafts = service.extractTasks("学校通知", "official");

        assertEquals(1, drafts.size());
        TaskDraft draft = drafts.get(0);
        assertEquals("完成心理健康排查", draft.title());
        assertEquals("德育", draft.category());
        assertEquals("P0", draft.priority());
        assertEquals("2026-10-30", draft.dueDate());
        assertTrue(draft.needReport());
        assertEquals("于10月30日前完成心理健康排查并报送", draft.sourceText());
        assertEquals(0.95, draft.confidence());
        assertFalse(draft.needsReview());
        assertTrue(requestBody.get().contains("qwen3.8-flash"));
        assertTrue(requestBody.get().contains(LocalDate.now(ZoneId.of("Asia/Shanghai")).toString()));
    }

    @Test
    void rejectsInvalidCategory() {
        responseContent = validTask().replace("德育", "其他");
        assertThrows(AiCallException.class, () -> service.extractTasks("学校通知", "doc"));
    }

    @Test
    void rejectsInvalidDate() {
        responseContent = validTask().replace("2026-10-30", "2026-02-31");
        assertThrows(AiCallException.class, () -> service.extractTasks("学校通知", "doc"));
    }

    @Test
    void rejectsBlankAndOverlongTitles() {
        responseContent = validTask().replace("完成心理健康排查", " ");
        assertThrows(AiCallException.class, () -> service.extractTasks("学校通知", "doc"));

        responseContent = validTask().replace("完成心理健康排查", "任".repeat(256));
        assertThrows(AiCallException.class, () -> service.extractTasks("学校通知", "doc"));
    }

    private String validTask() {
        return """
                {"tasks":[{"title":"完成心理健康排查","priority":"P0","dueDate":"2026-10-30",
                "needReport":true,"category":"德育","sourceText":"原文依据",
                "confidence":0.95,"needsReview":false,"reviewReason":null}]}
                """;
    }
}
