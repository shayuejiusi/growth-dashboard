package com.personal.dashboard.api;

import com.fasterxml.jackson.core.type.TypeReference;
import com.personal.dashboard.ai.AiGateway;
import com.personal.dashboard.ai.AiService.ReviewContext;
import com.personal.dashboard.model.ReviewDraft;
import com.personal.dashboard.model.TaskItem;
import com.personal.dashboard.service.JsonDocService;
import com.personal.dashboard.service.StatsService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

/**
 * 日复盘 API
 */
@RestController
@RequestMapping("/api/review")
public class ReviewController {

    private final JsonDocService docs;
    private final StatsService stats;
    private final AiGateway ai;

    public ReviewController(JsonDocService docs, StatsService stats, AiGateway ai) {
        this.docs = docs;
        this.stats = stats;
        this.ai = ai;
    }

    @GetMapping("/daily")
    public ResponseEntity<ReviewDraft> latest(@RequestAttribute("currentUser") com.personal.dashboard.model.User user) {
        String key = reviewKey(user.username());
        if (!docs.exists(key)) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(docs.load(key, new TypeReference<>() {}, () -> null));
    }

    /** 基于今日数据生成复盘草稿（AI，按当前用户） */
    @PostMapping("/daily/generate")
    public ReviewDraft generate(@RequestAttribute("currentUser") com.personal.dashboard.model.User user) {
        List<TaskItem> tasks = stats.tasks(user.username());
        LocalDate today = LocalDate.now();

        List<String> completedToday = tasks.stream()
                .filter(t -> t.status() == TaskItem.Status.DONE && t.completedAt() != null
                        && t.completedAt().toLocalDate().equals(today))
                .map(TaskItem::title).toList();
        List<String> overdueTitles = tasks.stream()
                .filter(TaskItem::isOverdue).map(TaskItem::title).toList();
        List<String> reportedToday = tasks.stream()
                .filter(t -> t.needReport() && t.status() == TaskItem.Status.DONE
                        && t.completedAt() != null && t.completedAt().toLocalDate().equals(today))
                .map(TaskItem::title).toList();

        ReviewDraft draft = ai.generateDailyReview(new ReviewContext(
                stats.taskStats(user.username()), completedToday, overdueTitles, reportedToday));
        docs.save(reviewKey(user.username()), draft);
        return draft;
    }

    /** 复盘文档按用户分 key 存储，实现多用户隔离 */
    private static String reviewKey(String username) {
        return "review:" + username;
    }
}
