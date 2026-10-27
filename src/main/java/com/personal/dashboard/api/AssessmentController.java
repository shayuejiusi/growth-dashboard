package com.personal.dashboard.api;

import com.fasterxml.jackson.core.type.TypeReference;
import com.personal.dashboard.ai.AiGateway;
import com.personal.dashboard.ai.AiService.AssessmentContext;
import com.personal.dashboard.auth.AuthService;
import com.personal.dashboard.model.AssessmentQuestion;
import com.personal.dashboard.model.AssessmentResult;
import com.personal.dashboard.model.User;
import com.personal.dashboard.service.AssessmentPaperStore;
import com.personal.dashboard.service.CapabilityService;
import com.personal.dashboard.service.JsonDocService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 能力评估 API：整合 8 个评估维度生成情景选择题，
 * 用户可跳过；跳过或完成后，评估功能对该用户关闭。
 */
@RestController
@RequestMapping("/api/assessment")
public class AssessmentController {

    private static final List<String> DIMENSIONS = List.of(
            "结构化表达", "情绪中立沟通", "主动预判", "主动解决问题",
            "跨部门协作", "团队管理与任务分配", "风险意识", "人才识别与培养");

    private final JsonDocService docs;
    private final AuthService auth;
    private final AiGateway ai;
    private final CapabilityService capabilityService;
    private final AssessmentPaperStore paperStore;

    public AssessmentController(JsonDocService docs, AuthService auth, AiGateway ai,
                                CapabilityService capabilityService, AssessmentPaperStore paperStore) {
        this.docs = docs;
        this.auth = auth;
        this.ai = ai;
        this.capabilityService = capabilityService;
        this.paperStore = paperStore;
    }

    private User currentUser(HttpServletRequest req) {
        return (User) req.getAttribute("currentUser");
    }

    private Map<String, AssessmentResult> results() {
        return docs.load("assessments", new TypeReference<LinkedHashMap<String, AssessmentResult>>() {},
                LinkedHashMap::new);
    }

    @GetMapping("/status")
    public Map<String, Object> status(HttpServletRequest req) {
        User u = currentUser(req);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("status", u.assessmentStatus());
        out.put("available", "NONE".equals(u.assessmentStatus()));
        out.put("questionCount", 16);
        AssessmentResult r = results().get(u.username());
        if (r != null) out.put("result", r);
        return out;
    }

    /** 获取评估试卷（仅在未评估状态时可用） */
    @GetMapping("/questions")
    public ResponseEntity<?> questions(HttpServletRequest req) {
        User u = currentUser(req);
        if (!"NONE".equals(u.assessmentStatus())) {
            throw ApiException.conflict("您已" + ("SKIPPED".equals(u.assessmentStatus()) ? "跳过" : "完成")
                    + "评估，该功能不可用");
        }
        List<AssessmentQuestion> paper = paperStore.computeIfAbsent(u.username(),
                () -> ai.generateAssessmentQuestions(new AssessmentContext(DIMENSIONS, u.name())));
        return ResponseEntity.ok(paper);
    }

    public record SubmitRequest(Map<String, Integer> answers) {}

    /** 提交答卷：按维度计分并写回能力成长地图 */
    @PostMapping("/submit")
    public ResponseEntity<?> submit(HttpServletRequest req, @RequestBody SubmitRequest body) {
        User u = currentUser(req);
        if (!"NONE".equals(u.assessmentStatus())) {
            throw ApiException.conflict("评估功能已不可用");
        }
        List<AssessmentQuestion> paper = paperStore.get(u.username());
        if (paper == null || paper.isEmpty()) {
            throw ApiException.badRequest("请先获取评估题目");
        }
        Map<String, Integer> answers = body.answers() == null ? Map.of() : body.answers();

        // 逐维度计分：该维度各题所选选项分值的平均分，四舍五入到 1-5
        Map<String, List<Integer>> dimScores = new LinkedHashMap<>();
        List<String> readable = new ArrayList<>();
        for (AssessmentQuestion q : paper) {
            Integer choice = answers.get(q.id());
            if (choice == null || choice < 0 || choice >= q.options().size()) {
                throw ApiException.badRequest("题目 " + q.id() + " 尚未作答");
            }
            AssessmentQuestion.Option opt = q.options().get(choice);
            dimScores.computeIfAbsent(q.dimension(), k -> new ArrayList<>()).add(opt.score());
            readable.add(q.id() + "（" + q.dimension() + "）：" + opt.label());
        }

        Map<String, Integer> finalScores = new LinkedHashMap<>();
        dimScores.forEach((dim, scores) -> {
            double avg = scores.stream().mapToInt(Integer::intValue).average().orElse(1);
            finalScores.put(dim, Math.max(1, Math.min(5, (int) Math.round(avg))));
        });
        int overall = (int) Math.round(finalScores.values().stream().mapToInt(Integer::intValue).average().orElse(1));

        String weakest = finalScores.entrySet().stream()
                .min(Comparator.comparingInt(Map.Entry::getValue))
                .map(Map.Entry::getKey).orElse("");
        String comment = switch (overall) {
            case 5 -> "整体表现优秀，各维度均衡发展，可作为团队标杆输出经验。";
            case 4 -> "整体表现良好，建议针对「" + weakest + "」定向突破。";
            case 3 -> "整体处于合格线，「" + weakest + "」是当前最明显短板，建议列入下阶段提升计划。";
            default -> "多项能力有待系统提升，建议从「" + weakest + "」开始，结合每日精选内容刻意练习。";
        };

        AssessmentResult result = new AssessmentResult(u.username(), LocalDateTime.now(),
                paper.size(), finalScores, overall, comment, readable);
        Map<String, AssessmentResult> all = results();
        all.put(u.username(), result);
        docs.save("assessments", all);

        // 写回能力成长地图
        String evidence = "能力评估问卷（" + paper.size() + " 题）· "
                + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"));
        finalScores.forEach((dim, s) -> capabilityService.updateAssessment(dim, s,
                "基于能力评估问卷答题结果自动评分，" + comment, evidence));

        auth.saveUser(u.withAssessmentStatus("COMPLETED"));
        paperStore.remove(u.username());
        return ResponseEntity.ok(result);
    }

    /** 跳过评估：跳过后该功能对该用户永久不可用 */
    @PostMapping("/skip")
    public ResponseEntity<?> skip(HttpServletRequest req) {
        User u = currentUser(req);
        if (!"NONE".equals(u.assessmentStatus())) {
            throw ApiException.conflict("评估功能已不可用");
        }
        auth.saveUser(u.withAssessmentStatus("SKIPPED"));
        paperStore.remove(u.username());
        return ResponseEntity.ok(Map.of("status", "SKIPPED", "message", "已跳过能力评估，该功能不再可用"));
    }
}
