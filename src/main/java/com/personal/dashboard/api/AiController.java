package com.personal.dashboard.api;

import com.personal.dashboard.ai.AiGateway;
import com.personal.dashboard.ai.AiService.TaskDraft;
import com.personal.dashboard.model.TaskItem;
import com.personal.dashboard.repo.TaskRepository;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * AI 能力入口 API：所有需要 AI 的功能统一从这里调用。
 * 实际调用 OpenAI 兼容服务还是本地规则引擎，由 AiGateway 按配置自动路由。
 */
@RestController
@RequestMapping("/api/ai")
public class AiController {

    private final AiGateway ai;
    private final TaskRepository taskRepo;
    private final com.personal.dashboard.service.FileTextExtractor extractor;

    public AiController(AiGateway ai, TaskRepository taskRepo,
                        com.personal.dashboard.service.FileTextExtractor extractor) {
        this.ai = ai;
        this.taskRepo = taskRepo;
        this.extractor = extractor;
    }

    /** AI 服务状态：是否已接入远程大模型 */
    @GetMapping("/status")
    public Map<String, Object> status() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("remoteConfigured", ai.isConfigured());
        out.put("provider", ai.providerName());
        out.put("hint", ai.isConfigured()
                ? "已接入远程 AI 服务。"
                : "当前使用本地规则引擎。在 application.properties 配置 ai.api-key 后自动接入远程大模型。");
        return out;
    }

    /** 文档识别生成待办：仅提取，不入库。mode: ai（默认，远程优先）| local（本地规则引擎）；kind: doc | official */
    @PostMapping("/doc-to-tasks")
    public List<TaskDraft> docToTasks(@RequestBody Map<String, String> body) {
        return ai.extractTasks(body.getOrDefault("text", ""),
                body.getOrDefault("kind", "doc"), body.getOrDefault("mode", "ai"));
    }

    /** 上传文件提取文本（.txt / .docx / .xlsx），供文档识别使用 */
    @PostMapping("/extract-text")
    public org.springframework.http.ResponseEntity<?> extractText(
            @RequestParam("file") org.springframework.web.multipart.MultipartFile file) throws java.io.IOException {
        String filename = file.getOriginalFilename() == null ? "" : file.getOriginalFilename();
        try {
            String text = extractor.extract(filename, file.getBytes());
            return org.springframework.http.ResponseEntity.ok(
                    Map.of("filename", filename, "text", text, "chars", text.length()));
        } catch (IllegalArgumentException e) {
            return org.springframework.http.ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /** 文档识别并一键导入任务清单（导入到当前用户名下） */
    @PostMapping("/doc-to-tasks/import")
    public Map<String, Object> docToTasksImport(@RequestBody Map<String, String> body,
                                                @RequestAttribute("currentUser") com.personal.dashboard.model.User user) {
        List<TaskDraft> drafts = ai.extractTasks(body.getOrDefault("text", ""),
                body.getOrDefault("kind", "doc"), body.getOrDefault("mode", "ai"));
        List<TaskItem> created = drafts.stream()
                .map(d -> TaskItem.create(d.title(), parsePriority(d.priority()),
                        d.dueDate() == null ? null : java.time.LocalDate.parse(d.dueDate()),
                        d.needReport(), d.capabilities(), "由文档识别自动生成"))
                .toList();
        taskRepo.saveAll(created.stream()
                .map(t -> com.personal.dashboard.entity.TaskEntity.from(t, user.username())).toList());
        return Map.of("imported", created.size(), "tasks", created);
    }

    private TaskItem.Priority parsePriority(String p) {
        if (p == null) return TaskItem.Priority.P2;
        return switch (p.toUpperCase()) {
            case "P0" -> TaskItem.Priority.P0;
            case "P1" -> TaskItem.Priority.P1;
            default -> TaskItem.Priority.P2;
        };
    }
}
