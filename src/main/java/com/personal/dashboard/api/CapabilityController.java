package com.personal.dashboard.api;

import com.personal.dashboard.ai.AiGateway;
import com.personal.dashboard.ai.AiService.CapabilityAssessment;
import com.personal.dashboard.ai.AiService.CapabilityContext;
import com.personal.dashboard.entity.CapabilityEntity;
import com.personal.dashboard.model.CapabilityDimension;
import com.personal.dashboard.repo.CapabilityRepository;
import com.personal.dashboard.service.StatsService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 能力成长地图 API：8 维度评分、目标分设定、AI 自动评估
 */
@RestController
@RequestMapping("/api/capabilities")
public class CapabilityController {

    private final CapabilityRepository repo;
    private final StatsService stats;
    private final AiGateway ai;

    public CapabilityController(CapabilityRepository repo, StatsService stats, AiGateway ai) {
        this.repo = repo;
        this.stats = stats;
        this.ai = ai;
    }

    private List<CapabilityDimension> dimensions() {
        return repo.findAllByOrderByDisplayOrderAsc().stream().map(CapabilityEntity::toRecord).toList();
    }

    @GetMapping
    public Map<String, Object> get() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("generatedAt", LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")));
        out.put("dimensions", dimensions());
        out.put("aiEnabled", ai.isConfigured());
        return out;
    }

    public record TargetRequest(int target) {}

    /** 手动设定某维度目标分 */
    @PutMapping("/{name}/target")
    public ResponseEntity<CapabilityDimension> setTarget(@PathVariable String name,
                                                         @RequestBody TargetRequest req) {
        return repo.findById(name).map(e -> {
            e.setTarget(Math.max(1, Math.min(5, req.target())));
            repo.save(e);
            return ResponseEntity.ok(e.toRecord());
        }).orElse(ResponseEntity.notFound().build());
    }

    /** AI 自动评估：依据待办完成情况重新打分（按当前用户的任务数据） */
    @PostMapping("/analyze")
    public Map<String, Object> analyze(@RequestAttribute("currentUser") com.personal.dashboard.model.User user) {
        List<CapabilityDimension> dims = dimensions();
        CapabilityContext ctx = new CapabilityContext(
                stats.taskStats(user.username()),
                dims.stream().map(CapabilityDimension::name).toList());
        List<CapabilityAssessment> assessments = ai.assessCapabilities(ctx);

        for (CapabilityAssessment a : assessments) {
            repo.findById(a.name()).ifPresent(e -> {
                e.setScore(Math.max(1, Math.min(5, a.score())));
                e.setReasoning(a.reasoning());
                e.setEvidence(a.evidence());
                repo.save(e);
            });
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("generatedAt", LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")));
        out.put("dimensions", dimensions());
        out.put("aiProvider", ai.providerName());
        return out;
    }
}
